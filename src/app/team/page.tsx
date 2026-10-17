import Link from 'next/link';
import { CareTaskForm } from '@/components/CareTaskForm';
import { ScheduleCareDialog } from '@/components/ScheduleCareDialog';
import { createFarmTask, assignFarmTask, completeFarmTask } from './actions';
import { assignCareItem } from '@/app/care/actions';
import { displayDate, careStatus } from '@/lib/care-dates';
import { requireFarm } from '@/lib/farm-access';
import { prisma } from '@/lib/prisma';
import { MemberControls } from './MemberControls';
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
  if (!['MANAGER', 'SUPER_ADMIN'].includes(membership.role)) return <main className="page-shell"><h1 className="font-display text-4xl">Your team</h1><p className="mt-4">Only farm managers can invite team members.</p></main>;

  const [members, horses, tasks, farmTasks, recentTasks] = await Promise.all([
    prisma.farmMember.findMany({
      where: { farmId, status: 'ACTIVE' },
      select: { id: true, userId: true, role: true, user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.horse.findMany({ where: { farmId, status: { not: 'RETIRED' } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.vetItem.findMany({ where: { horse: { farmId }, nextDueDate: { not: null } }, include: { horse: { select: { name: true } } }, orderBy: [{ nextDueDate: 'asc' }, { itemName: 'asc' }] }),
    prisma.farmTask.findMany({ where: { farmId, completedAt: null }, orderBy: [{ createdAt: 'desc' }] }),
    prisma.farmTask.findMany({ where: { farmId, completedAt: { not: null } }, orderBy: { completedAt: 'desc' }, take: 5 }),
  ]);
  const tasksByMember = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const key = task.assignedMemberId ?? '';
    tasksByMember.set(key, [...(tasksByMember.get(key) ?? []), task]);
  }


  return <>
    <main className="page-shell">
      <header className="mb-5"><p className="eyebrow">Farm workspace</p><h1 className="mt-3 font-display text-4xl">Your team</h1><p className="mt-3 text-sm text-[#657067]">Assign work and see who’s doing what.</p></header>
      <div className="grid items-start gap-5 xl:grid-cols-2">
      <section aria-labelledby="team-tasks-heading" className="premium-card rounded-3xl p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 id="team-tasks-heading" className="font-display text-2xl">Team tasks</h2><p className="mt-1 text-sm text-[#657067]">Write a farm task or assign scheduled horse care.</p></div><ScheduleCareDialog horses={horses} members={members} /></div>
        <CareTaskForm action={createFarmTask} className="reinwell-form mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="sm:col-span-3">New task<input name="title" required maxLength={300} placeholder="e.g. Clean the tack room" /></label>
          <label className="sm:col-span-2">Assign to<select name="assignedMemberId" required defaultValue=""><option value="" disabled>Select a teammate</option>{members.map(member => <option key={member.id} value={member.id}>{member.user.name || member.user.email}</option>)}</select></label>
          <div className="flex items-end"><button className="button-primary">Create task</button></div>
          <details className="sm:col-span-3"><summary className="cursor-pointer text-xs font-semibold text-[#657067]">Add a due date (optional)</summary><label className="mt-2 block max-w-xs">Due date<input name="dueDate" type="date" /></label></details>
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
    <section className="min-w-0" aria-labelledby="farm-members-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="farm-members-heading" className="font-display text-2xl">Farm members ({members.length})</h2>
        <a href="/team" className="text-sm underline">Refresh members</a>
      </div>
      <p className="mb-3 text-sm text-[#657067]">Active members of {membership.farm.name}. Teammates appear here after accepting their invitation.</p>
      <ul className="premium-card divide-y divide-[#e6e8e2] rounded-3xl px-6">
        {members.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-5">
          <div className="min-w-0"><p className="font-medium text-[#17201a]">{member.user.name || member.user.email}</p><p className="break-all text-sm text-[#657067]">{member.user.email}</p></div>
          <span className="rounded-full bg-[#f0f3ec] px-3 py-1 text-sm text-[#384b3b]">{member.role === 'SUPER_ADMIN' ? 'Owner' : member.role === 'MANAGER' ? 'Manager' : 'Staff'}</span>
          <details className="w-full rounded-2xl bg-[#f0f3ec] p-3">
            <summary className="cursor-pointer text-sm font-semibold">Assigned work ({(tasksByMember.get(member.id) ?? []).length + farmTasks.filter(task => task.assignedMemberId === member.id).length})</summary>
            {(tasksByMember.get(member.id) ?? []).length ? <ul className="mt-3 space-y-3">{(tasksByMember.get(member.id) ?? []).map(task => <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><div><Link href={`/care?horseId=${task.horseId}`} className="font-medium underline">{task.horse.name} · {task.itemName}</Link><p className={`mt-1 text-xs ${careStatus(task.nextDueDate!) === 'overdue' ? 'text-[#a24b35]' : 'text-[#657067]'}`}>{careStatus(task.nextDueDate!) === 'overdue' ? 'Overdue · ' : 'Due '}{displayDate(task.nextDueDate!)}</p></div><CareTaskForm action={assignCareItem}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="assignedMemberId" value="" /><button className="button-secondary text-xs" aria-label={`Unassign ${task.itemName} from ${member.user.name || member.user.email}`}>Unassign</button></CareTaskForm></li>)}</ul> : <p className="mt-2 text-xs text-[#657067]">No care assigned.</p>}
            <ul className="mt-2 space-y-2">{farmTasks.filter(task => task.assignedMemberId === member.id).map(task => <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><div><p className="font-medium">{task.title}</p><p className="text-xs text-[#657067]">{task.dueDate ? `Due ${displayDate(task.dueDate)}` : 'No due date'}</p></div><div className="flex gap-2"><CareTaskForm action={completeFarmTask}><input type="hidden" name="id" value={task.id} /><button className="button-primary text-xs">Complete</button></CareTaskForm><CareTaskForm action={assignFarmTask}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="assignedMemberId" value="" /><button className="button-secondary text-xs">Unassign</button></CareTaskForm></div></li>)}</ul>
          </details>
          {member.userId === membership.userId ? <p className="w-full text-xs text-[#657067]">Your account · ask another manager to change your access.</p> : member.role === 'SUPER_ADMIN' ? <p className="w-full text-xs text-[#657067]">Owner access is protected.</p> : <MemberControls key={`${member.id}-${member.role}`} memberId={member.id} name={member.user.name || member.user.email} role={member.role} />}
        </li>)}
      </ul>
    </section>
    </div>
    {farmTasks.some(task => !task.assignedMemberId) && <section className="premium-card mt-5 rounded-2xl p-4"><h2 className="font-display text-xl">Unassigned farm tasks</h2>{farmTasks.filter(task => !task.assignedMemberId).map(task => <p key={task.id} className="mt-2 text-sm">{task.title}</p>)}</section>}
    {recentTasks.length > 0 && <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold">Recently completed farm tasks</summary><ul className="mt-3 space-y-2">{recentTasks.map(task => <li key={task.id} className="text-sm">{task.title}<p className="text-xs text-[#657067]">{task.completedByName} · {displayDate(task.completedAt!)}</p></li>)}</ul></details>}
    <details className="premium-card mt-5 rounded-2xl p-4"><summary className="cursor-pointer text-sm font-semibold">Invite a teammate</summary><TeamForm /></details>
    </main>
  </>;
}
