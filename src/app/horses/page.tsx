import { HorseAvatar } from '@/components/HorseAvatar';
import { HorseSearchFilters } from '@/components/HorseSearchFilters';
import { SearchHighlight } from '@/components/SearchHighlight';
import { horseSearchScore } from '@/lib/horse-search';
import { canManageFarm } from '@/lib/permissions';
import { singleParams } from '@/lib/input-validation';
import { requireFarm } from '@/lib/farm-access';
import { prisma } from '@/lib/prisma';
import { getDaysSince, activityOverdue } from '@/lib/care-dates';
import Link from 'next/link';
import { ArrowUpRight, Clock3, ShieldCheck, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const statusLabels: Record<string, string> = { ACTIVE: 'Active', IN_TRAINING: 'In training', RESTING: 'Resting', MEDICAL_HOLD: 'Medical hold', RETIRED: 'Retired' };

function lastActivity(days: number | null) {
  if (days === null) return 'Not recorded';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default async function HorsesPage(
  props: { searchParams: Promise<{ q?: string; status?: string; overdue?: string; sort?: string }> }
) {
  const searchParams = singleParams(await props.searchParams);
  const { membership } = await requireFarm();
  const now = new Date();
  const horses = await prisma.horse.findMany({
    where: { farmId: membership.farmId }, orderBy: { name: 'asc' },
    include: { rides: { orderBy: { dateTime: 'desc' }, take: 1, select: { dateTime: true } }, washes: { orderBy: { dateTime: 'desc' }, take: 1, select: { dateTime: true } } },
  });
  const attention = horses.filter((horse) => {
    const ride = horse.rides[0] ? getDaysSince(horse.rides[0].dateTime, now) : null;
    const groom = horse.washes[0] ? getDaysSince(horse.washes[0].dateTime, now) : null;
    return activityOverdue(ride, horse.rideIntervalDays) || activityOverdue(groom, horse.washIntervalDays);
  }).length;

  const query = (searchParams.q ?? '').trim().slice(0, 100);
  const scores = new Map(horses.map(horse => [horse.id, horseSearchScore(horse, query)]));
  const filtered = horses.filter(horse => {
    const ride = horse.rides[0] ? getDaysSince(horse.rides[0].dateTime, now) : null;
    const groom = horse.washes[0] ? getDaysSince(horse.washes[0].dateTime, now) : null;
    const overdue = activityOverdue(ride, horse.rideIntervalDays) || activityOverdue(groom, horse.washIntervalDays);
    return scores.get(horse.id) !== null
      && (!searchParams.status || horse.status === searchParams.status)
      && (searchParams.overdue !== 'yes' || overdue);
  });

  if (query && !searchParams.sort) filtered.sort((a, b) => (scores.get(a.id) ?? 0) - (scores.get(b.id) ?? 0) || a.name.localeCompare(b.name));
  if (searchParams.sort === 'name-desc') filtered.reverse();
  if (searchParams.sort === 'recent') filtered.sort((a, b) => (b.rides[0]?.dateTime.getTime() ?? 0) - (a.rides[0]?.dateTime.getTime() ?? 0));

  return (
    <main className="page-shell">
      <header className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">The stable</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">Your horses</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#68736b]">Horse profiles, ride and grooming records, and care schedules.</p></div>
        <div className="flex flex-wrap gap-3 text-sm">{canManageFarm(membership.role) && <Link href="/horses/new" className="button-primary">Add horse</Link>}
          <div className="premium-card rounded-xl px-4 py-3"><span className="font-display text-xl">{horses.length}</span><span className="ml-2 text-xs text-[#778078]">total</span></div>
          <div className="premium-card rounded-xl px-4 py-3"><span className={`font-display text-xl ${attention ? 'text-[#a24b35]' : 'text-[#315c47]'}`}>{attention}</span><span className="ml-2 text-xs text-[#778078]">need attention</span></div>
        </div>
      </header>

      <HorseSearchFilters query={query} status={searchParams.status ?? ''} overdue={searchParams.overdue ?? ''} sort={searchParams.sort ?? ''} scope={`${membership.userId}:${membership.farmId}`} />
      <p role="status" className="mb-5 text-sm text-[#667169]">{filtered.length} of {horses.length} horses</p>
      <div id="horse-results">
      {horses.length > 0 && filtered.length === 0 && <div className="premium-card rounded-2xl p-10 text-center"><h2 className="font-display text-2xl">No matching horses</h2><p className="mt-2 text-sm">Try a shorter name, a breed, or clear the status and care filters.</p></div>}

      {horses.length === 0 ? (
        <div className="premium-card flex min-h-96 flex-col items-center justify-center rounded-3xl px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e4ece5] text-[#315c47]"><Sparkles className="h-7 w-7" /></div>
          <h2 className="mt-6 font-display text-3xl">Begin your stable</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#778078]">Create the first horse profile to start tracking activity and care.</p>
          {canManageFarm(membership.role) ? <Link href="/horses/new" className="button-primary mt-6">Add your first horse</Link> : <p className="mt-6 text-sm text-[#778078]">Your manager can add the first horse.</p>}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((horse, index) => {
            const rideDays = horse.rides[0] ? getDaysSince(horse.rides[0].dateTime, now) : null;
            const groomDays = horse.washes[0] ? getDaysSince(horse.washes[0].dateTime, now) : null;
            const rideOverdue = activityOverdue(rideDays, horse.rideIntervalDays);
            const groomOverdue = activityOverdue(groomDays, horse.washIntervalDays);
            const needsAttention = rideOverdue || groomOverdue;
            const palette = ['bg-[#dce7df] text-[#315c47]', 'bg-[#e9e1d3] text-[#806537]', 'bg-[#dfe6e8] text-[#526975]', 'bg-[#e7dedb] text-[#81594c]'][index % 4];
            return (
              <Link key={horse.id} href={`/horses/${horse.id}`} data-horse-result className="premium-card group overflow-hidden rounded-3xl transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="flex items-start justify-between p-6 pb-5">
                  <HorseAvatar id={horse.id} name={horse.name} photo={horse.photo} className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-display text-2xl ${palette}`} />
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${needsAttention ? 'bg-[#f4e5df] text-[#a24b35]' : 'bg-[#e4ece5] text-[#315c47]'}`}>{needsAttention ? 'Attention' : statusLabels[horse.status] ?? horse.status}</span>
                </div>
                <div className="px-6 pb-6">
                  <div className="flex items-end justify-between gap-4"><div className="min-w-0"><h2 className="truncate font-display text-3xl"><SearchHighlight text={horse.name} query={query} /></h2><p className="mt-1 truncate text-xs font-medium text-[#7b837c]"><SearchHighlight text={[horse.breed, horse.age !== null ? `${horse.age} years` : null].filter(Boolean).join(' · ') || 'Profile details pending'} query={query} /></p></div><ArrowUpRight className="h-5 w-5 shrink-0 text-[#b0b5b0] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#315c47]" /></div>
                  <div className="my-5 h-px bg-[#e6e3da]" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-2xl p-3 ${rideOverdue ? 'bg-[#f7ebe6]' : 'bg-white/65'}`}><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#909690]"><Clock3 className="h-3 w-3" /> Last ride</div><p className={`mt-2 text-xs font-semibold ${rideOverdue ? 'text-[#a24b35]' : 'text-[#3d4b42]'}`}>{lastActivity(rideDays)}</p></div>
                    <div className={`rounded-2xl p-3 ${groomOverdue ? 'bg-[#f7ebe6]' : 'bg-white/65'}`}><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#909690]"><ShieldCheck className="h-3 w-3" /> Grooming</div><p className={`mt-2 text-xs font-semibold ${groomOverdue ? 'text-[#a24b35]' : 'text-[#3d4b42]'}`}>{lastActivity(groomDays)}</p></div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      </div>
    </main>
  );
}
