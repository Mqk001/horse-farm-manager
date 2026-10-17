import { OptimisticTaskRow, OptimisticTasksProvider } from '@/components/OptimisticTaskRow';
import { inputDate, displayDate, careStatus } from '@/lib/care-dates';
import { canManageFarm } from '@/lib/permissions';
import { singleParams } from '@/lib/input-validation';
import { requireFarm } from '@/lib/farm-access';
import Link from 'next/link';
import { CareTaskForm } from '@/components/CareTaskForm';
import { ScheduleCareDialog } from '@/components/ScheduleCareDialog';
import { prisma } from '@/lib/prisma';
import { CalendarCheck, Check, ChevronRight, Clock3, Plus } from 'lucide-react';
import { assignCareItem, completeCareItem, rescheduleCareItem } from './actions';

export const dynamic = 'force-dynamic';
type CareItem = Awaited<ReturnType<typeof getCareData>>['items'][number];

async function getCareData(horseId?: string) {
  const { farmId, membership } = await requireFarm();
  return Promise.all([
    prisma.horse.findMany({ where: { farmId, status: { not: 'RETIRED' } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.vetItem.findMany({ where: { horse: { farmId }, ...(horseId ? { horseId } : {}) }, include: { horse: { select: { id: true, name: true } }, assignedMember: { include: { user: { select: { name: true, email: true } } } } }, orderBy: [{ nextDueDate: 'asc' }, { itemName: 'asc' }] }),
    prisma.farmMember.findMany({ where: { farmId, status: 'ACTIVE' }, include: { user: { select: { name: true, email: true } } }, orderBy: { id: 'asc' } }),
  ]).then(([horses, items, members]) => ({ horses, items, members, membership }));
}

type Member = Awaited<ReturnType<typeof getCareData>>['members'][number];
function CareRow({ item, members, canAssign }: { item: CareItem; members: Member[]; canAssign: boolean }) {
  const due = item.nextDueDate!;
  const overdue = careStatus(due) === 'overdue';
  return (
    <OptimisticTaskRow taskKey={`care:${item.id}`} as="article" label={`${item.horse.name} · ${item.itemName}`} className="group grid gap-4 border-b border-[#e8e5dc] px-5 py-5 last:border-0 sm:grid-cols-[3.5rem_1fr_auto] sm:items-center sm:px-7">
      <div className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl ${overdue ? 'bg-[#f4e5df] text-[#a24b35]' : 'bg-[#e4ece5] text-[#315c47]'}`}><span className="text-[9px] font-bold uppercase tracking-wider">{due.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</span><span className="font-display text-xl leading-none">{due.getUTCDate()}</span></div>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold text-[#26332a]">{item.itemName}</h3>{overdue && <span className="rounded-full bg-[#f4e5df] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#a24b35]">Overdue</span>}</div><p className="mt-1 text-xs text-[#7b837c]"><Link href={`/horses/${item.horse.id}`} className="font-semibold text-[#52695b] hover:text-[#183d2f]">{item.horse.name}</Link> · {item.itemType.replaceAll('_', ' ').toLowerCase()}{item.intervalDays ? ` · every ${item.intervalDays} days` : ''}</p><p className="mt-1 text-xs text-[#52695b]">{item.assignedMember ? item.assignedMember.status === 'ACTIVE' ? `Assigned to ${item.assignedMember.user.name ?? item.assignedMember.user.email}` : 'Assignment needs review: member inactive' : 'Unassigned'}</p>{item.vetName && <p className="mt-1 text-[11px] text-[#9a9f9a]">With {item.vetName}</p>}</div>
      <div className="flex flex-wrap items-center gap-2">
        {canAssign && <details><summary className="button-secondary cursor-pointer text-xs">Assign</summary><CareTaskForm action={assignCareItem} className="reinwell-form mt-2 flex flex-wrap gap-2"><input type="hidden" name="id" value={item.id} /><select aria-label={`Assign ${item.itemName}`} name="assignedMemberId" defaultValue={item.assignedMemberId ?? ''}><option value="">Unassigned</option>{members.map(member => <option key={member.id} value={member.id}>{member.user.name ?? member.user.email}</option>)}</select><button className="button-primary">Save assignment</button></CareTaskForm></details>}
        <CareTaskForm action={completeCareItem} optimistic="complete"><input type="hidden" name="expectedDueDate" value={due.toISOString()} /><input type="hidden" name="id" value={item.id} /><button aria-label={`Complete ${item.itemName}`} className="flex h-9 items-center gap-2 rounded-xl bg-[#183d2f] px-3 text-xs font-bold text-white transition hover:bg-[#0f2d22]"><Check className="h-3.5 w-3.5" /> Complete</button></CareTaskForm>
        {canAssign && <details className="relative"><summary className="flex h-9 cursor-pointer list-none items-center rounded-xl border border-[#dcd9d0] bg-white/60 px-3 text-xs font-bold text-[#677168]">Reschedule</summary><CareTaskForm action={rescheduleCareItem} className="absolute right-0 z-20 mt-2 flex w-64 gap-2 rounded-2xl border border-[#dedbd1] bg-[#fbfaf6] p-3 shadow-xl"><input type="hidden" name="id" value={item.id} /><input aria-label={`New date for ${item.itemName}`} type="date" name="nextDueDate" required defaultValue={inputDate(due)} className="min-w-0 flex-1 rounded-lg border border-[#d6d3ca] bg-white px-2 text-xs" /><button className="rounded-lg bg-[#183d2f] px-3 text-xs font-bold text-white">Save</button></CareTaskForm></details>}
      </div>
    </OptimisticTaskRow>
  );
}

function CareSection({ title, note, items, members, canAssign }: { title: string; note: string; items: CareItem[]; members: Member[]; canAssign: boolean }) {
  return (
    <section className="premium-card overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between border-b border-[#e5e2d9] px-5 py-5 sm:px-7"><div><h2 className="font-display text-2xl">{title}</h2><p className="mt-1 text-xs text-[#7b837c]">{note}</p></div><span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[#ebece6] px-2 text-xs font-bold text-[#566159]">{items.length}</span></div>
      {items.length ? items.map(item => <CareRow key={item.id} item={item} members={members} canAssign={canAssign} />) : <div className="flex items-center gap-3 px-7 py-8 text-sm text-[#8a918b]"><CalendarCheck className="h-5 w-5 text-[#8fa896]" /> Nothing scheduled here.</div>}
    </section>
  );
}

export default async function CarePage({ searchParams }: { searchParams: Promise<{ horseId?: string; assigned?: string }> }) {
  const { horseId, assigned } = singleParams(await searchParams);
  const { horses, items, members, membership } = await getCareData(horseId);
  const canAssign = canManageFarm(membership.role);
  const now = new Date();
  const scheduled = items.filter(item => item.nextDueDate && (assigned !== 'mine' || item.assignedMemberId === membership.id) && (assigned !== 'unassigned' || !item.assignedMemberId));
  const overdue = scheduled.filter(item => careStatus(item.nextDueDate!, now) === 'overdue');
  const today = scheduled.filter(item => careStatus(item.nextDueDate!, now) === 'today');
  const upcoming = scheduled.filter(item => careStatus(item.nextDueDate!, now) === 'upcoming');
  const selected = horses.find(horse => horse.id === horseId);

  return (
    <OptimisticTasksProvider><main className="page-shell">
      <header className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Scheduled care</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">Care schedule</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#68736b]">Track due dates, complete care, and assign tasks. Dates use UTC.</p></div>
        {canAssign && <ScheduleCareDialog horses={horses} members={members} selectedHorseId={selected?.id} />}
      </header>

      <form action="/care" className="reinwell-form premium-card mb-6 flex flex-wrap items-end gap-3 rounded-2xl p-4"><input type="hidden" name="horseId" value={horseId ?? ''} /><label>Task assignments<select name="assigned" defaultValue={assigned ?? ''}><option value="">All tasks</option><option value="mine">Assigned to me</option><option value="unassigned">Unassigned</option></select></label><button className="button-primary">Filter tasks</button><a href="/care" className="button-secondary">Clear filters</a></form>
      <section className="mb-6 grid grid-cols-3 gap-3">
        {[{ label: 'Overdue', value: overdue.length, color: 'text-[#a24b35]', bg: 'bg-[#f4e5df]' }, { label: 'Today', value: today.length, color: 'text-[#806537]', bg: 'bg-[#eee7d8]' }, { label: 'Upcoming', value: upcoming.length, color: 'text-[#315c47]', bg: 'bg-[#e4ece5]' }].map(metric => <div key={metric.label} className="premium-card rounded-2xl p-4 sm:p-5"><div className={`mb-4 flex h-8 w-8 items-center justify-center rounded-lg ${metric.bg} ${metric.color}`}><Clock3 className="h-4 w-4" /></div><p className={`font-display text-3xl ${metric.color}`}>{metric.value}</p><p className="mt-1 text-[11px] font-semibold text-[#7b837c]">{metric.label}</p></div>)}
      </section>

      {selected && <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#cfd9d0] bg-[#e7eee7] px-5 py-3 text-sm text-[#315c47]"><span>Showing care for <strong>{selected.name}</strong></span><Link href="/care" className="text-xs font-bold">Clear filter</Link></div>}
      <div className="space-y-6"><CareSection title="Overdue" note="Responsibilities that need attention now." items={overdue} members={members} canAssign={canAssign} /><CareSection title="Today" note="The stable’s priorities for today." items={today} members={members} canAssign={canAssign} /><CareSection title="Upcoming" note="Future care in chronological order." items={upcoming} members={members} canAssign={canAssign} /></div>
    </main></OptimisticTasksProvider>
  );
}
