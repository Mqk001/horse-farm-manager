import { displayCost } from '@/lib/completion-details';
import { DismissalUndoNotice } from '@/components/DismissalUndoNotice';
import { OptimisticTaskRow, OptimisticTasksProvider } from '@/components/OptimisticTaskRow';
import Link from 'next/link';
import { CareTaskForm } from '@/components/CareTaskForm';
import { ScheduleCareDialog } from '@/components/ScheduleCareDialog';
import { createFarmTask, assignFarmTask, completeFarmTask, dismissCompletedTask, restoreDismissedTask } from './actions';
import { assignCareItem } from '@/app/care/actions';
import { displayDate, careStatus } from '@/lib/care-dates';
import { requireFarm } from '@/lib/farm-access';
import { prisma } from '@/lib/prisma';
import { MemberControls } from './MemberControls';
import { teamRevision } from '@/lib/team-revision';
import { TeamRefresh } from './TeamRefresh';
import TeamForm from './TeamForm';

async function assignExistingTask(data: FormData) {
  'use server';
  const value = data.get('id')?.toString() ?? '';
  const [kind, id] = value.split(':');
  if (!id || !['farm', 'care'].includes(kind)) throw new Error('Select a task.');
  data.set('id', id);
  if (kind === 'farm') await assignFarmTask(data);
  else await assignCareItem(data);
}

export default async function TeamPage() {
  const { membership, farmId } = await requireFarm();
  if (!['MANAGER', 'SUPER_ADMIN'].includes(membership.role)) return <OptimisticTasksProvider><main className="page-shell"><h1 className="font-display text-4xl">Your team</h1><p className="mt-4">Only farm managers can invite team members.</p></main></OptimisticTasksProvider>;

  const [members, horses, tasks, farmTasks, recentTasks, completedCare, revision] = await Promise.all([
    prisma.farmMember.findMany({
      where: { farmId, status: 'ACTIVE' },
      select: { id: true, userId: true, role: true, user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.horse.findMany({ where: { farmId, status: { not: 'RETIRED' } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.vetItem.findMany({ where: { horse: { farmId }, nextDueDate: { not: null } }, include: { horse: { select: { name: true } } }, orderBy: [{ nextDueDate: 'asc' }, { itemName: 'asc' }] }),
    prisma.farmTask.findMany({ where: { farmId, completedAt: null }, orderBy: [{ createdAt: 'desc' }] }),
    prisma.farmTask.findMany({ where: { farmId, completedAt: { not: null }, dismissedAt: null }, orderBy: { completedAt: 'desc' } }),
    prisma.careCompletion.findMany({ where: { horse: { farmId }, dismissedAt: null }, include: { horse: { select: { name: true } } }, orderBy: { completedAt: 'desc' } }),
    teamRevision(farmId),
  ]);
  const tasksByMember = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const key = task.assignedMemberId ?? '';
    tasksByMember.set(key, [...(tasksByMember.get(key) ?? []), task]);
  }


  return <>
    <OptimisticTasksProvider><main className="page-shell">
      <TeamRefresh revision={revision} />
      <header className="mb-5"><p className="eyebrow">Farm workspace</p><h1 className="mt-3 font-display text-4xl">Your team</h1><p className="mt-3 text-sm text-[#657067]">Assign work and see who’s doing what.</p></header>
      <div className="grid items-start gap-5 xl:grid-cols-2">
      <section aria-labelledby="team-tasks-heading" className="premium-card rounded-3xl p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 id="team-tasks-heading" className="font-display text-2xl">Team tasks</h2><p className="mt-1 text-sm text-[#657067]">Write a farm task or assign scheduled horse care.</p></div><ScheduleCareDialog horses={horses} members={members} /></div>
        <CareTaskForm action={createFarmTask} className="reinwell-form mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="sm:col-span-2">New task<input name="title" required maxLength={300} placeholder="e.g. Clean the tack room" /></label>
          <label className="min-w-0">Assign to<select name="assignedMemberId" required defaultValue=""><option value="" disabled>Select a teammate</option>{members.map(member => <option key={member.id} value={member.id}>{member.user.name || member.user.email}</option>)}</select></label>
          <div className="flex items-end"><button className="button-primary min-h-[3.25rem]">Create task</button></div>
          <details className="sm:col-span-2"><summary className="cursor-pointer text-xs font-semibold text-[#657067]">Add a due date (optional)</summary><label className="mt-2 block max-w-xs">Due date<input name="dueDate" type="date" /></label></details>
        </CareTaskForm>
        <details className="mt-4 border-t border-[#e5e2d9] pt-3"><summary className="cursor-pointer text-sm font-semibold text-[#315c47]">Assign an existing task or horse care</summary>
        {tasks.length || farmTasks.length ? <CareTaskForm action={assignExistingTask} className="reinwell-form mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1">Existing task<select name="id" required defaultValue=""><option value="" disabled>Select a task</option>{farmTasks.map(task => <option key={task.id} value={`farm:${task.id}`}>{task.title} · Farm task</option>)}{tasks.map(task => <option key={task.id} value={`care:${task.id}`}>{task.horse.name} · {task.itemName} · {displayDate(task.nextDueDate!)} · {members.find(member => member.id === task.assignedMemberId)?.user.name ?? (task.assignedMemberId ? 'Assigned' : 'Unassigned')}</option>)}</select></label>
          <label className="min-w-0 flex-1">Assign to<select name="assignedMemberId" required defaultValue=""><option value="" disabled>Select a teammate</option>{members.map(member => <option key={member.id} value={member.id}>{member.user.name || member.user.email}</option>)}</select></label>
          <button className="button-primary">Assign task</button>
        </CareTaskForm> : <p className="mt-6 text-sm text-[#657067]">No scheduled care yet. Schedule care above to create your first team task.</p>}
        <p className="mt-4 text-xs text-[#657067]">{(tasksByMember.get('') ?? []).length} unassigned · <Link href="/care?assigned=unassigned" className="font-semibold underline">Review unassigned care</Link> · Due dates use UTC.</p>
        </details>
      </section>
    <section className="premium-card min-w-0 rounded-3xl p-5 sm:p-7" aria-labelledby="farm-members-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="farm-members-heading" className="font-display text-2xl">Farm members ({members.length})</h2>
        <a href="/team" className="text-sm underline">Refresh members</a>
      </div>
      <p className="mb-3 text-sm text-[#657067]">Active members of {membership.farm.name}. Teammates appear here after accepting their invitation.</p>
      <ul className="divide-y divide-[#e6e8e2]">
        {members.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-5">
          <div className="min-w-0 flex-1"><p className="font-medium text-[#17201a]">{member.user.name || member.user.email}</p><p className="break-all text-sm text-[#657067]">{member.user.email}</p></div>
          <span className="shrink-0 rounded-full bg-[#f0f3ec] px-3 py-1 text-sm text-[#384b3b]">{member.role === 'SUPER_ADMIN' ? 'Owner' : member.role === 'MANAGER' ? 'Manager' : 'Staff'}</span>
          <details className="w-full rounded-2xl bg-[#f0f3ec] p-3">
            <summary className="cursor-pointer text-sm font-semibold">Assigned work ({(tasksByMember.get(member.id) ?? []).length + farmTasks.filter(task => task.assignedMemberId === member.id).length})</summary>
            {(tasksByMember.get(member.id) ?? []).length ? <ul className="mt-3 space-y-3">{(tasksByMember.get(member.id) ?? []).map(task => <OptimisticTaskRow as="li" taskKey={`care:${task.id}:${task.nextDueDate!.toISOString()}`} key={task.id} label={`${task.horse.name} · ${task.itemName}`} className="grid gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><Link href={`/care?horseId=${task.horseId}`} className="font-medium underline">{task.horse.name} · {task.itemName}</Link><p className={`mt-1 text-xs ${careStatus(task.nextDueDate!) === 'overdue' ? 'text-[#a24b35]' : 'text-[#657067]'}`}>{task.lastDoneDate ? 'Next scheduled · ' : careStatus(task.nextDueDate!) === 'overdue' ? 'Overdue · ' : 'Due '}{displayDate(task.nextDueDate!)}</p></div><CareTaskForm action={assignCareItem} optimistic="unassign"><input type="hidden" name="id" value={task.id} /><input type="hidden" name="assignedMemberId" value="" /><button className="button-secondary text-xs" aria-label={`Unassign ${task.itemName} from ${member.user.name || member.user.email}`}>Unassign</button></CareTaskForm></OptimisticTaskRow>)}</ul> : <p className="mt-2 text-xs text-[#657067]">No horse care assigned.</p>}
            <ul className="mt-2 space-y-2">{farmTasks.filter(task => task.assignedMemberId === member.id).map(task => <OptimisticTaskRow as="li" taskKey={`farm:${task.id}`} key={task.id} label={task.title} className="grid gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><p className="font-medium">{task.title}</p><p className="text-xs text-[#657067]">{task.dueDate ? `Due ${displayDate(task.dueDate)}` : 'No due date'}</p></div><div className="flex flex-wrap gap-2 sm:justify-end"><CareTaskForm action={completeFarmTask} optimistic="complete"><input type="hidden" name="id" value={task.id} /><button className="button-primary text-xs">Complete</button></CareTaskForm><CareTaskForm action={assignFarmTask} optimistic="unassign"><input type="hidden" name="id" value={task.id} /><input type="hidden" name="assignedMemberId" value="" /><button className="button-secondary text-xs">Unassign</button></CareTaskForm></div></OptimisticTaskRow>)}</ul>
          </details>
          {member.userId === membership.userId ? <p className="w-full text-xs text-[#657067]">Your account · ask another manager to change your access.</p> : member.role === 'SUPER_ADMIN' ? <p className="w-full text-xs text-[#657067]">Owner access is protected.</p> : <MemberControls key={`${member.id}-${member.role}`} memberId={member.id} name={member.user.name || member.user.email} role={member.role} />}
        </li>)}
      </ul>
    </section>
    </div>
    {farmTasks.some(task => !task.assignedMemberId) && <section className="premium-card mt-5 rounded-2xl p-4"><h2 className="font-display text-xl">Unassigned farm tasks</h2>{farmTasks.filter(task => !task.assignedMemberId).map(task => <p key={task.id} className="mt-2 text-sm">{task.title}</p>)}</section>}
    <section id="completed-work" aria-label="Completed work" className="premium-card mt-5 rounded-3xl p-5 sm:p-7">
      <h2 className="font-display text-2xl">Completed work ({recentTasks.length + completedCare.length})</h2>
      <p className="mt-1 text-sm text-[#657067]">Review completed work, then dismiss it from this list. Recorded history is kept.</p>
      {recentTasks.length + completedCare.length === 0 ? <p className="mt-4 text-sm text-[#657067]">No completed work waiting for review.</p> : <ul className="mt-4 divide-y divide-[#e6e8e2]">{[
        ...recentTasks.map(task => ({ id: task.id, kind: 'farm', title: task.title, by: task.completedByName, date: task.completedAt!, notes: null, product: null, cost: '' })),
        ...completedCare.map(task => ({ id: task.id, kind: 'care', title: `${task.horse.name} · ${task.itemName}`, by: task.completedByName, date: task.completedAt, notes: task.completionNotes, product: task.productUsed, cost: displayCost(task.costCents, task.costCurrency) })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime()).map(task => <OptimisticTaskRow as="li" taskKey={`review:${task.kind}:${task.id}`} label={task.title} key={`${task.kind}-${task.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{task.title} <span className="ml-2 rounded-full bg-[#e4ece5] px-2 py-1 text-xs text-[#315c47]">Completed</span></p><p className="mt-1 text-xs text-[#657067]">{task.by || 'Recorded completion'} · {displayDate(task.date)}</p>{(task.notes || task.product || task.cost) && <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold">Completion details</summary>{task.product && <p className="mt-2">Product: {task.product}</p>}{task.cost && <p className="mt-2">Cost: {task.cost}</p>}{task.notes && <p className="mt-2 whitespace-pre-wrap break-words">{task.notes}</p>}</details>}</div><CareTaskForm action={dismissCompletedTask} optimistic="dismiss" dismissalUndo={{ scope: `${membership.userId}:${membership.farmId}`, id: task.id, kind: task.kind as 'farm' | 'care', title: task.title }}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="kind" value={task.kind} /><button className="button-secondary" aria-label={`Dismiss ${task.title}`}>Dismiss</button></CareTaskForm></OptimisticTaskRow>)}</ul>}
    </section>
    <details className="premium-card mt-5 rounded-2xl p-4"><summary className="cursor-pointer text-sm font-semibold">Invite a teammate</summary><TeamForm /></details>
      <DismissalUndoNotice scope={`${membership.userId}:${membership.farmId}`} action={restoreDismissedTask} />
    </main></OptimisticTasksProvider>
  </>;
}
