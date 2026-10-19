import { careWeek, careHref, validCalendarDate } from '@/lib/care-calendar';
import { OptimisticTaskRow, OptimisticTasksProvider } from '@/components/OptimisticTaskRow';
import { CareReminderPreference } from '@/components/CareReminderPreference';
import { remindersAvailable } from '@/lib/reminder-security';
import { inputDate, displayDate, careStatus } from '@/lib/care-dates';
import { canManageFarm } from '@/lib/permissions';
import { singleParams } from '@/lib/input-validation';
import { requireFarm } from '@/lib/farm-access';
import Link from 'next/link';
import { CareTaskForm } from '@/components/CareTaskForm';
import { ScheduleCareDialog } from '@/components/ScheduleCareDialog';
import { prisma } from '@/lib/prisma';
import { CalendarCheck, Check, Clock3 } from 'lucide-react';
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
function CareRow({ item, members, canAssign, compact = false }: { item: CareItem; members: Member[]; canAssign: boolean; compact?: boolean }) {
  const due = item.nextDueDate!;
  const overdue = careStatus(due) === 'overdue';
  const actions = (<div className="mt-2 flex flex-wrap items-center gap-2">
        {canAssign && <details><summary className="button-secondary cursor-pointer text-xs">Assign</summary><CareTaskForm action={assignCareItem} className={compact ? "reinwell-form mt-2 grid min-w-0 gap-2 [&_select]:min-w-0 [&_select]:w-full" : "reinwell-form mt-2 flex flex-wrap gap-2"}><input type="hidden" name="id" value={item.id} /><select aria-label={`Assign ${item.itemName}`} name="assignedMemberId" defaultValue={item.assignedMemberId ?? ''}><option value="">Unassigned</option>{members.map(member => <option key={member.id} value={member.id}>{member.user.name ?? member.user.email}</option>)}</select><button className={compact ? "button-primary !px-2 !py-2 !text-xs" : "button-primary"}>Save assignment</button></CareTaskForm></details>}
        <CareTaskForm action={completeCareItem} optimistic="complete"><input type="hidden" name="expectedDueDate" value={due.toISOString()} /><input type="hidden" name="id" value={item.id} /><button aria-label={`Complete ${item.itemName}`} className="flex h-9 items-center gap-2 rounded-xl bg-[#183d2f] px-3 text-xs font-bold text-white transition hover:bg-[#0f2d22]"><Check className="h-3.5 w-3.5" /> Complete</button></CareTaskForm>
        {canAssign && <details className="relative"><summary className="flex h-9 cursor-pointer list-none items-center rounded-xl border border-[#dcd9d0] bg-white/60 px-3 text-xs font-bold text-[#677168]">Reschedule</summary><CareTaskForm action={rescheduleCareItem} className={compact ? "reinwell-form mt-2 grid w-full gap-2" : "absolute right-0 z-20 mt-2 flex w-64 gap-2 rounded-2xl border border-[#dedbd1] bg-[#fbfaf6] p-3 shadow-xl"}><input type="hidden" name="id" value={item.id} /><input aria-label={`New date for ${item.itemName}`} type="date" name="nextDueDate" required defaultValue={inputDate(due)} className={compact ? "min-w-0 !p-1 !text-xs" : "min-w-0 flex-1 rounded-lg border border-[#d6d3ca] bg-white px-2 text-xs"} /><button className="rounded-lg bg-[#183d2f] px-3 text-xs font-bold text-white">Save</button></CareTaskForm></details>}
        </div>);
  return (
    <OptimisticTaskRow taskKey={`care:${item.id}`} as="article" label={`${item.horse.name} · ${item.itemName}`} className={compact ? "break-words rounded-xl border border-[#dedfd4] bg-white p-3 shadow-sm" : "group grid gap-4 border-b border-[#e8e5dc] px-5 py-5 last:border-0 sm:grid-cols-[3.5rem_1fr_auto] sm:items-center sm:px-7"}>
      {!compact && <div className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl ${overdue ? 'bg-[#f4e5df] text-[#a24b35]' : 'bg-[#e4ece5] text-[#315c47]'}`}><span className="text-[9px] font-bold uppercase tracking-wider">{due.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</span><span className="font-display text-xl leading-none">{due.getUTCDate()}</span></div>}
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-bold text-[#26332a]">{item.itemName}</h3>{overdue && <span className="rounded-full bg-[#f4e5df] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#a24b35]">Overdue</span>}</div><p className="mt-1 text-xs text-[#7b837c]"><Link href={`/horses/${item.horse.id}`} className="font-semibold text-[#52695b] hover:text-[#183d2f]">{item.horse.name}</Link> · {item.itemType.replaceAll('_', ' ').toLowerCase()}{item.intervalDays ? ` · every ${item.intervalDays} days` : ''}</p><p className="mt-1 text-xs text-[#52695b]">{item.assignedMember ? item.assignedMember.status === 'ACTIVE' ? `Assigned to ${item.assignedMember.user.name ?? item.assignedMember.user.email}` : 'Assignment needs review: member inactive' : 'Unassigned'}</p>{item.vetName && <p className="mt-1 text-[11px] text-[#9a9f9a]">With {item.vetName}</p>}</div>
      {compact ? <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-[#315c47]">Task actions</summary>{actions}</details> : actions}
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

export default async function CarePage({ searchParams }: { searchParams: Promise<{ horseId?: string; assigned?: string; view?: string; week?: string }> }) {
  const params = singleParams(await searchParams);
  const { horseId, assigned } = params;
  const weekly = params.view === 'week';
  const { horses, items, members, membership } = await getCareData(horseId);
  const canAssign = canManageFarm(membership.role);
  const now = new Date();
  const scheduled = items.filter(item => item.nextDueDate && (assigned !== 'mine' || item.assignedMemberId === membership.id) && (assigned !== 'unassigned' || !item.assignedMemberId));
  const overdue = scheduled.filter(item => careStatus(item.nextDueDate!, now) === 'overdue');
  const today = scheduled.filter(item => careStatus(item.nextDueDate!, now) === 'today');
  const upcoming = scheduled.filter(item => careStatus(item.nextDueDate!, now) === 'upcoming');
  const week = careWeek(params.week, now);
  const scope = { view: weekly ? 'week' : undefined, week: inputDate(week.start), horseId, assigned };
  const weekItems = scheduled.filter(item => item.nextDueDate! >= week.start && item.nextDueDate! < week.end);
  const weekDays = week.days.map(day => ({ date: day, items: weekItems.filter(item => inputDate(item.nextDueDate!) === inputDate(day)) }));
  const busiest = weekDays.reduce((best, day) => day.items.length > best.items.length ? day : best, weekDays[0]);
  const weekday = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const beforeWeek = overdue.filter(item => item.nextDueDate! < week.start).length;
  const workload = new Map<string, { label: string; count: number }>();
  for (const item of weekItems) {
    const member = members.find(member => member.id === item.assignedMemberId);
    const key = member?.id ?? (item.assignedMemberId ? 'inactive' : 'unassigned');
    const label = member ? member.user.name ?? member.user.email : item.assignedMemberId ? 'Assignment needs review' : 'Unassigned';
    const previous = workload.get(key);
    workload.set(key, { label, count: (previous?.count ?? 0) + 1 });
  }
  const selected = horses.find(horse => horse.id === horseId);

  return (
    <OptimisticTasksProvider><main className="page-shell">
      <header className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Scheduled care</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">Care schedule</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#68736b]">Track due dates, complete care, and assign tasks. Dates use UTC.</p></div>
        {canAssign && <ScheduleCareDialog horses={horses} members={members} selectedHorseId={selected?.id} defaultDueDate={weekly ? inputDate(now >= week.start && now < week.end ? now : week.start) : undefined} />}
      </header>

      <nav aria-label="Care views" className="mb-5 inline-flex gap-1 rounded-2xl border border-[#dedbd1] bg-white/60 p-1">
        <a href={careHref({ ...scope, view: undefined })} aria-current={!weekly ? 'page' : undefined} className={`rounded-xl px-4 py-2 text-sm font-bold ${!weekly ? 'bg-[#183d2f] text-white' : 'text-[#52695b]'}`}>List</a>
        <a href={careHref({ ...scope, view: 'week' })} aria-current={weekly ? 'page' : undefined} className={`rounded-xl px-4 py-2 text-sm font-bold ${weekly ? 'bg-[#183d2f] text-white' : 'text-[#52695b]'}`}>Week calendar</a>
      </nav>

      <form key={`${horseId}:${assigned}:${scope.view}:${scope.week}`} action="/care" className="reinwell-form premium-card mb-6 flex flex-wrap items-end gap-3 rounded-2xl p-4">
        {weekly && <><input type="hidden" name="view" value="week" /><input type="hidden" name="week" value={inputDate(week.start)} /></>}
        <label>Horse<select aria-label="Horse" name="horseId" defaultValue={horseId ?? ''}><option value="">All horses</option>{horses.map(horse => <option key={horse.id} value={horse.id}>{horse.name}</option>)}</select></label>
        <label>Task assignments<select aria-label="Task assignments" name="assigned" defaultValue={assigned ?? ''}><option value="">All tasks</option><option value="mine">Assigned to me</option><option value="unassigned">Unassigned</option></select></label><button className="button-primary">Filter tasks</button><a href={careHref({ view: scope.view, week: scope.week })} className="button-secondary">Clear filters</a>
      </form>
      <section className="mb-6 grid grid-cols-3 gap-3">
        {(weekly ? [{ label: 'This week', value: weekItems.length, color: 'text-[#315c47]', bg: 'bg-[#e4ece5]' }, { label: 'Unassigned', value: weekItems.filter(item => !item.assignedMemberId).length, color: 'text-[#806537]', bg: 'bg-[#eee7d8]' }, { label: weekItems.length ? `Busiest: ${weekday(busiest.date)}` : 'Busiest day', value: busiest.items.length, color: 'text-[#315c47]', bg: 'bg-[#e4ece5]' }] : [{ label: 'Overdue', value: overdue.length, color: 'text-[#a24b35]', bg: 'bg-[#f4e5df]' }, { label: 'Today', value: today.length, color: 'text-[#806537]', bg: 'bg-[#eee7d8]' }, { label: 'Upcoming', value: upcoming.length, color: 'text-[#315c47]', bg: 'bg-[#e4ece5]' }]).map(metric => <div key={metric.label} className="premium-card rounded-2xl p-4 sm:p-5"><div className={`mb-4 flex h-8 w-8 items-center justify-center rounded-lg ${metric.bg} ${metric.color}`}><Clock3 className="h-4 w-4" /></div><p className={`font-display text-3xl ${metric.color}`}>{metric.value}</p><p className="mt-1 text-[11px] font-semibold text-[#7b837c]">{metric.label}</p></div>)}
      </section>

      {selected && <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#cfd9d0] bg-[#e7eee7] px-5 py-3 text-sm text-[#315c47]"><span>Showing care for <strong>{selected.name}</strong></span><a href={careHref({ ...scope, horseId: undefined })} className="text-xs font-bold">Clear filter</a></div>}
      {weekly ? <section aria-label="Weekly care calendar" className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="font-display text-2xl">{displayDate(week.start)} – {displayDate(week.days[6])}</h2><p className="mt-1 text-xs text-[#68736b]">Monday–Sunday · due dates, not appointment times · UTC</p></div>
          <nav aria-label="Calendar week navigation" className="flex flex-wrap gap-2">
            {validCalendarDate(week.previous) && <a href={careHref({ ...scope, week: week.previous })} className="button-secondary">Previous week</a>}
            <a href={careHref({ ...scope, week: inputDate(now) })} className="button-secondary">This week</a>
            {validCalendarDate(week.next) && <a href={careHref({ ...scope, week: week.next })} className="button-secondary">Next week</a>}
          </nav>
        </header>
        {beforeWeek > 0 && <p className="rounded-xl border border-[#ead2c7] bg-[#f7ebe6] p-4 text-sm text-[#a24b35]">{beforeWeek} overdue {beforeWeek === 1 ? 'task needs' : 'tasks need'} attention before this week. <a href={careHref({ ...scope, view: undefined })} className="font-bold underline">Review overdue care</a></p>}
        <div className="grid gap-3 xl:grid-cols-7">
          {weekDays.map(day => {
            const today = inputDate(day.date) === inputDate(now);
            return <section key={inputDate(day.date)} aria-label={displayDate(day.date)} className={`min-w-0 rounded-2xl border p-3 ${today ? 'border-[#8fa896] bg-[#e9efe7]' : 'border-[#dedbd1] bg-[#f5f3ec]'}`}>
              <header className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold"><time dateTime={inputDate(day.date)} aria-current={today ? 'date' : undefined}>{weekday(day.date)} {day.date.getUTCDate()}</time>{today && <span className="ml-2 text-[10px] text-[#315c47]">Today</span>}</h3><span className="text-xs text-[#68736b]">{day.items.length} {day.items.length === 1 ? 'task' : 'tasks'}</span></header>
              <div className="space-y-3">{day.items.length ? day.items.map(item => <CareRow key={item.id} item={item} members={members} canAssign={canAssign} compact />) : <p className="py-4 text-xs text-[#7b837c]">No care due.</p>}</div>
            </section>;
          })}
        </div>
        <section aria-label="Weekly workload" className="premium-card rounded-2xl p-5"><h3 className="text-sm font-bold">Workload this week</h3><p className="mt-1 text-xs text-[#68736b]">Scheduled care matching your current filters.</p>
          {workload.size ? <ul className="mt-4 flex flex-wrap gap-3">{Array.from(workload.entries()).sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label)).map(([key, entry]) => <li key={key} className="rounded-xl bg-[#eef0e8] px-4 py-3 text-sm"><span className="font-semibold">{entry.label}</span><span className="ml-2 text-[#68736b]">{entry.count} {entry.count === 1 ? 'task' : 'tasks'}</span></li>)}</ul> : <p className="mt-4 text-sm text-[#68736b]">No care scheduled this week. Choose another week or adjust your filters.</p>}
        </section>
      </section> : <div className="space-y-6"><CareSection title="Overdue" note="Responsibilities that need attention now." items={overdue} members={members} canAssign={canAssign} /><CareSection title="Today" note="The stable’s priorities for today." items={today} members={members} canAssign={canAssign} /><CareSection title="Upcoming" note="Future care in chronological order." items={upcoming} members={members} canAssign={canAssign} /></div>}
      <div className="mt-8"><CareReminderPreference key={membership.id} enabled={membership.careReminderEnabled} available={remindersAvailable()} manager={canAssign} farmName={membership.farm.name} /></div>
    </main></OptimisticTasksProvider>
  );
}
