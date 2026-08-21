import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import {
  completeCareItem,
  createCareItem,
  rescheduleCareItem,
} from './actions';

export const dynamic = 'force-dynamic';

type CareItem = Awaited<ReturnType<typeof getCareData>>['items'][number];

function startOfDay(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date = new Date()) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function getCareData(horseId?: string) {
  const [horses, items] = await Promise.all([
    prisma.horse.findMany({
      where: { status: { not: 'RETIRED' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.vetItem.findMany({
      where: horseId ? { horseId } : undefined,
      include: { horse: { select: { id: true, name: true } } },
      orderBy: [{ nextDueDate: 'asc' }, { itemName: 'asc' }],
    }),
  ]);

  return { horses, items };
}

function CareCard({ item }: { item: CareItem }) {
  const nextDueDate = item.nextDueDate!;
  const today = startOfDay();
  const overdue = nextDueDate < today;

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              {item.itemType.replaceAll('_', ' ')}
            </span>
            {overdue && (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                Overdue
              </span>
            )}
          </div>
          <h3 className="mt-3 text-lg font-bold text-gray-900">{item.itemName}</h3>
          <Link
            href={`/horses/${item.horse.id}`}
            className="mt-1 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {item.horse.name}
          </Link>
          <p className={`mt-2 text-sm font-medium ${overdue ? 'text-red-600' : 'text-gray-600'}`}>
            Due {formatDate(nextDueDate)}
            {item.intervalDays ? ` · repeats every ${item.intervalDays} days` : ' · one time'}
          </p>
          {item.vetName && <p className="mt-1 text-sm text-gray-500">Provider: {item.vetName}</p>}
          {item.notes && <p className="mt-2 text-sm text-gray-500">{item.notes}</p>}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:w-44">
          <form action={completeCareItem}>
            <input type="hidden" name="id" value={item.id} />
            <button className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Mark complete
            </button>
          </form>
          <form action={rescheduleCareItem} className="flex gap-2">
            <input type="hidden" name="id" value={item.id} />
            <input
              aria-label={`Reschedule ${item.itemName}`}
              type="date"
              name="nextDueDate"
              required
              defaultValue={toDateInput(nextDueDate)}
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-2 text-xs"
            />
            <button
              aria-label={`Save new due date for ${item.itemName}`}
              className="rounded-lg bg-gray-100 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              Save
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

function CareSection({ title, description, items }: { title: string; description: string; items: CareItem[] }) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
          {items.length}
        </span>
      </div>
      {items.length ? (
        <div className="space-y-3">{items.map((item) => <CareCard key={item.id} item={item} />)}</div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          Nothing here right now.
        </div>
      )}
    </section>
  );
}

export default async function CarePage({
  searchParams,
}: {
  searchParams: Promise<{ horseId?: string }>;
}) {
  const { horseId } = await searchParams;
  const { horses, items } = await getCareData(horseId);
  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const scheduled = items.filter((item) => item.nextDueDate !== null);
  const overdue = scheduled.filter((item) => item.nextDueDate! < todayStart);
  const today = scheduled.filter(
    (item) => item.nextDueDate! >= todayStart && item.nextDueDate! <= todayEnd,
  );
  const upcoming = scheduled.filter((item) => item.nextDueDate! > todayEnd);
  const selectedHorse = horses.find((horse) => horse.id === horseId);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-800 px-6 py-8 text-white">
            <p className="text-sm font-medium text-blue-100">Daily operations</p>
            <h1 className="mt-2 text-3xl font-bold">Care Planner</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100">
              See what is due, complete recurring care, and keep every horse on schedule.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 p-5">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">Overdue</p>
              <p className="mt-1 text-3xl font-bold text-red-700">{overdue.length}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-700">Today</p>
              <p className="mt-1 text-3xl font-bold text-amber-700">{today.length}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-700">Upcoming</p>
              <p className="mt-1 text-3xl font-bold text-blue-700">{upcoming.length}</p>
            </div>
          </div>
        </div>

        <details className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" open={items.length === 0}>
          <summary className="cursor-pointer text-lg font-bold text-gray-900">Add care item</summary>
          <form action={createCareItem} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Horse
              <select
                name="horseId"
                required
                defaultValue={selectedHorse?.id ?? ''}
                className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
              >
                <option value="" disabled>Select a horse</option>
                {horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Care type
              <select name="itemType" required className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5">
                <option value="VACCINATION">Vaccination</option>
                <option value="FARRIER">Farrier</option>
                <option value="DENTAL">Dental</option>
                <option value="DEWORMING">Deworming</option>
                <option value="MEDICATION">Medication</option>
                <option value="VET_VISIT">Vet visit</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Task name
              <input name="itemName" required maxLength={100} placeholder="e.g. Spring vaccinations" className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Next due
              <input name="nextDueDate" type="date" required defaultValue={toDateInput(new Date())} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Repeat every (days)
              <input name="intervalDays" type="number" min={1} max={3650} placeholder="Leave blank for one-time care" className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Provider
              <input name="vetName" maxLength={100} placeholder="Vet, farrier, or clinic" className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
            </label>
            <label className="text-sm font-medium text-gray-700 md:col-span-2">
              Notes
              <textarea name="notes" rows={3} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5" />
            </label>
            <button disabled={horses.length === 0} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2">
              Add to planner
            </button>
          </form>
        </details>

        {selectedHorse && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span>Showing care for <strong>{selectedHorse.name}</strong></span>
            <Link href="/care" className="font-semibold hover:text-blue-950">Show all horses</Link>
          </div>
        )}

        <div className="mt-8 space-y-10">
          <CareSection title="Overdue" description="Care that needs attention now." items={overdue} />
          <CareSection title="Today" description="Tasks scheduled for today." items={today} />
          <CareSection title="Upcoming" description="Future care, ordered by due date." items={upcoming} />
        </div>
      </div>
    </main>
  );
}
