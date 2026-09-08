import { requireFarm } from '@/lib/farm-access';
import Link from 'next/link';
import { CareDialog } from '@/components/CareDialog';
import { prisma } from '@/lib/prisma';
import { CalendarCheck, Check, ChevronRight, Clock3, Plus } from 'lucide-react';
import { completeCareItem, createCareItem, rescheduleCareItem } from './actions';

export const dynamic = 'force-dynamic';
type CareItem = Awaited<ReturnType<typeof getCareData>>['items'][number];

function startOfDay(date = new Date()) { const result = new Date(date); result.setHours(0, 0, 0, 0); return result; }
function endOfDay(date = new Date()) { const result = new Date(date); result.setHours(23, 59, 59, 999); return result; }
function inputDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function displayDate(date: Date) { return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

async function getCareData(horseId?: string) {
  const { farmId } = await requireFarm();
  return Promise.all([
    prisma.horse.findMany({ where: { farmId, status: { not: 'RETIRED' } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.vetItem.findMany({ where: { horse: { farmId }, ...(horseId ? { horseId } : {}) }, include: { horse: { select: { id: true, name: true } } }, orderBy: [{ nextDueDate: 'asc' }, { itemName: 'asc' }] }),
  ]).then(([horses, items]) => ({ horses, items }));
}

function CareRow({ item }: { item: CareItem }) {
  const due = item.nextDueDate!;
  const overdue = due < startOfDay();
  return (
    <article className="group grid gap-4 border-b border-[#e8e5dc] px-5 py-5 last:border-0 sm:grid-cols-[3.5rem_1fr_auto] sm:items-center sm:px-7">
      <div className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl ${overdue ? 'bg-[#f4e5df] text-[#a24b35]' : 'bg-[#e4ece5] text-[#315c47]'}`}><span className="text-[9px] font-bold uppercase tracking-wider">{due.toLocaleDateString('en-US', { month: 'short' })}</span><span className="font-display text-xl leading-none">{due.getDate()}</span></div>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold text-[#26332a]">{item.itemName}</h3>{overdue && <span className="rounded-full bg-[#f4e5df] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#a24b35]">Overdue</span>}</div><p className="mt-1 text-xs text-[#7b837c]"><Link href={`/horses/${item.horse.id}`} className="font-semibold text-[#52695b] hover:text-[#183d2f]">{item.horse.name}</Link> · {item.itemType.replaceAll('_', ' ').toLowerCase()}{item.intervalDays ? ` · every ${item.intervalDays} days` : ''}</p>{item.vetName && <p className="mt-1 text-[11px] text-[#9a9f9a]">With {item.vetName}</p>}</div>
      <div className="flex items-center gap-2">
        <form action={completeCareItem}><input type="hidden" name="id" value={item.id} /><button aria-label={`Complete ${item.itemName}`} className="flex h-9 items-center gap-2 rounded-xl bg-[#183d2f] px-3 text-xs font-bold text-white transition hover:bg-[#0f2d22]"><Check className="h-3.5 w-3.5" /> Complete</button></form>
        <details className="relative"><summary className="flex h-9 cursor-pointer list-none items-center rounded-xl border border-[#dcd9d0] bg-white/60 px-3 text-xs font-bold text-[#677168]">Reschedule</summary><form action={rescheduleCareItem} className="absolute right-0 z-20 mt-2 flex w-64 gap-2 rounded-2xl border border-[#dedbd1] bg-[#fbfaf6] p-3 shadow-xl"><input type="hidden" name="id" value={item.id} /><input aria-label={`New date for ${item.itemName}`} type="date" name="nextDueDate" required defaultValue={inputDate(due)} className="min-w-0 flex-1 rounded-lg border border-[#d6d3ca] bg-white px-2 text-xs" /><button className="rounded-lg bg-[#183d2f] px-3 text-xs font-bold text-white">Save</button></form></details>
      </div>
    </article>
  );
}

function CareSection({ title, note, items }: { title: string; note: string; items: CareItem[] }) {
  return (
    <section className="premium-card overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between border-b border-[#e5e2d9] px-5 py-5 sm:px-7"><div><h2 className="font-display text-2xl">{title}</h2><p className="mt-1 text-xs text-[#7b837c]">{note}</p></div><span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[#ebece6] px-2 text-xs font-bold text-[#566159]">{items.length}</span></div>
      {items.length ? items.map(item => <CareRow key={item.id} item={item} />) : <div className="flex items-center gap-3 px-7 py-8 text-sm text-[#8a918b]"><CalendarCheck className="h-5 w-5 text-[#8fa896]" /> Nothing scheduled here.</div>}
    </section>
  );
}

export default async function CarePage({ searchParams }: { searchParams: Promise<{ horseId?: string }> }) {
  const { horseId } = await searchParams;
  const { horses, items } = await getCareData(horseId);
  const todayStart = startOfDay(); const todayEnd = endOfDay();
  const scheduled = items.filter(item => item.nextDueDate);
  const overdue = scheduled.filter(item => item.nextDueDate! < todayStart);
  const today = scheduled.filter(item => item.nextDueDate! >= todayStart && item.nextDueDate! <= todayEnd);
  const upcoming = scheduled.filter(item => item.nextDueDate! > todayEnd);
  const selected = horses.find(horse => horse.id === horseId);

  return (
    <main className="page-shell">
      <header className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Daily rhythm</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">Care schedule</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#68736b]">One calm, chronological view of every appointment and recurring responsibility.</p></div>
        <CareDialog action={createCareItem} disabled={!horses.length}>
          <label className="text-xs font-bold text-[#59645c]">Horse<select name="horseId" required defaultValue={selected?.id ?? ''} className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal"><option value="" disabled>Select a horse</option>{horses.map(horse => <option key={horse.id} value={horse.id}>{horse.name}</option>)}</select></label>
          <label className="text-xs font-bold text-[#59645c]">Care type<select name="itemType" className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal"><option value="VACCINATION">Vaccination</option><option value="FARRIER">Farrier</option><option value="DENTAL">Dental</option><option value="DEWORMING">Deworming</option><option value="MEDICATION">Medication</option><option value="VET_VISIT">Vet visit</option><option value="OTHER">Other</option></select></label>
          <label className="text-xs font-bold text-[#59645c]">Task name<input name="itemName" required maxLength={100} placeholder="Spring vaccinations" className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-[#59645c]">Next due<input name="nextDueDate" type="date" required defaultValue={inputDate(new Date())} className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-[#59645c]">Repeat every (days)<input name="intervalDays" type="number" min={1} max={3650} placeholder="Optional" className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-[#59645c]">Provider<input name="vetName" maxLength={100} placeholder="Vet, farrier, or clinic" className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-[#59645c] sm:col-span-2">Notes<textarea name="notes" rows={3} className="mt-2 w-full rounded-xl border border-[#d9d6cd] bg-white px-3 py-3 text-sm font-normal" /></label>
        </CareDialog>
      </header>

      <section className="mb-6 grid grid-cols-3 gap-3">
        {[{ label: 'Overdue', value: overdue.length, color: 'text-[#a24b35]', bg: 'bg-[#f4e5df]' }, { label: 'Today', value: today.length, color: 'text-[#806537]', bg: 'bg-[#eee7d8]' }, { label: 'Upcoming', value: upcoming.length, color: 'text-[#315c47]', bg: 'bg-[#e4ece5]' }].map(metric => <div key={metric.label} className="premium-card rounded-2xl p-4 sm:p-5"><div className={`mb-4 flex h-8 w-8 items-center justify-center rounded-lg ${metric.bg} ${metric.color}`}><Clock3 className="h-4 w-4" /></div><p className={`font-display text-3xl ${metric.color}`}>{metric.value}</p><p className="mt-1 text-[11px] font-semibold text-[#7b837c]">{metric.label}</p></div>)}
      </section>

      {selected && <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#cfd9d0] bg-[#e7eee7] px-5 py-3 text-sm text-[#315c47]"><span>Showing care for <strong>{selected.name}</strong></span><Link href="/care" className="text-xs font-bold">Clear filter</Link></div>}
      <div className="space-y-6"><CareSection title="Overdue" note="Responsibilities that need attention now." items={overdue} /><CareSection title="Today" note="The stable’s priorities for today." items={today} /><CareSection title="Upcoming" note="Future care in chronological order." items={upcoming} /></div>
    </main>
  );
}
