import Link from 'next/link';
import { CareTaskForm } from '@/components/CareTaskForm';
import { ScheduleCareDialog } from '@/components/ScheduleCareDialog';
import { assignCareItem } from '@/app/care/actions';
import { displayDate, careStatus } from '@/lib/care-dates';
import { requireFarm } from '@/lib/farm-access';
import { prisma } from '@/lib/prisma';
import { MemberControls } from './MemberControls';
import TeamForm from './TeamForm';

export default async function TeamPage() {
  const { membership, farmId } = await requireFarm();
  if (!['MANAGER', 'SUPER_ADMIN'].includes(membership.role)) return <main className="page-shell"><h1 className="font-display text-4xl">Your team</h1><p className="mt-4">Only farm managers can invite team members.</p></main>;

  const [members, horses, tasks] = await Promise.all([
    prisma.farmMember.findMany({
      where: { farmId, status: 'ACTIVE' },
      select: { id: true, userId: true, role: true, user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.horse.findMany({ where: { farmId, status: { not: 'RETIRED' } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.vetItem.findMany({ where: { horse: { farmId }, nextDueDate: { not: null } }, include: { horse: { select: { name: true } } }, orderBy: [{ nextDueDate: 'asc' }, { itemName: 'asc' }] }),
  ]);
  const tasksByMember = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const key = task.assignedMemberId ?? '';
    tasksByMember.set(key, [...(tasksByMember.get(key) ?? []), task]);
  }


  return <>
    <main className="page-shell">
      <header className="mb-8"><p className="eyebrow">Farm workspace</p><h1 className="mt-3 font-display text-4xl">Your team</h1><p className="mt-3 text-sm text-[#657067]">Assign care, review workloads, and manage your farm’s members.</p></header>
      <section aria-labelledby="team-tasks-heading" className="premium-card rounded-3xl p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 id="team-tasks-heading" className="font-display text-2xl">Team tasks</h2><p className="mt-2 text-sm text-[#657067]">Schedule new care or assign an existing task. Assigned care appears in your teammate’s My tasks.</p></div><ScheduleCareDialog horses={horses} members={members} /></div>
        {tasks.length ? <CareTaskForm action={assignCareItem} className="reinwell-form mt-6 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1">Care task<select name="id" required defaultValue=""><option value="" disabled>Select a task</option>{tasks.map(task => <option key={task.id} value={task.id}>{task.horse.name} · {task.itemName} · {displayDate(task.nextDueDate!)} · {members.find(member => member.id === task.assignedMemberId)?.user.name ?? (task.assignedMemberId ? 'Assigned' : 'Unassigned')}</option>)}</select></label>
          <label className="min-w-0 flex-1">Assign to<select name="assignedMemberId" required defaultValue=""><option value="" disabled>Select a teammate</option>{members.map(member => <option key={member.id} value={member.id}>{member.user.name || member.user.email}</option>)}</select></label>
          <button className="button-primary">Assign task</button>
        </CareTaskForm> : <p className="mt-6 text-sm text-[#657067]">No scheduled care yet. Schedule care above to create your first team task.</p>}
        <p className="mt-4 text-xs text-[#657067]">{(tasksByMember.get('') ?? []).length} unassigned · <Link href="/care?assigned=unassigned" className="font-semibold underline">Review unassigned care</Link> · Due dates use UTC.</p>
      </section>
    </main>
    <TeamForm />
    <section className="page-shell pt-0" aria-labelledby="farm-members-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="farm-members-heading" className="font-display text-2xl">Farm members ({members.length})</h2>
        <a href="/team" className="text-sm underline">Refresh members</a>
      </div>
      <p className="mb-5 text-sm text-[#657067]">Active members of {membership.farm.name}. Teammates appear here after accepting their invitation.</p>
      <ul className="premium-card divide-y divide-[#e6e8e2] rounded-3xl px-6">
        {members.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-5">
          <div className="min-w-0"><p className="font-medium text-[#17201a]">{member.user.name || member.user.email}</p><p className="break-all text-sm text-[#657067]">{member.user.email}</p></div>
          <span className="rounded-full bg-[#f0f3ec] px-3 py-1 text-sm text-[#384b3b]">{member.role === 'SUPER_ADMIN' ? 'Owner' : member.role === 'MANAGER' ? 'Manager' : 'Staff'}</span>
          <div className="w-full rounded-2xl bg-[#f0f3ec] p-4">
            <h3 className="text-sm font-semibold">Assigned care ({(tasksByMember.get(member.id) ?? []).length})</h3>
            {(tasksByMember.get(member.id) ?? []).length ? <ul className="mt-3 space-y-3">{(tasksByMember.get(member.id) ?? []).map(task => <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><div><Link href={`/care?horseId=${task.horseId}`} className="font-medium underline">{task.horse.name} · {task.itemName}</Link><p className={`mt-1 text-xs ${careStatus(task.nextDueDate!) === 'overdue' ? 'text-[#a24b35]' : 'text-[#657067]'}`}>{careStatus(task.nextDueDate!) === 'overdue' ? 'Overdue · ' : 'Due '}{displayDate(task.nextDueDate!)}</p></div><CareTaskForm action={assignCareItem}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="assignedMemberId" value="" /><button className="button-secondary text-xs" aria-label={`Unassign ${task.itemName} from ${member.user.name || member.user.email}`}>Unassign</button></CareTaskForm></li>)}</ul> : <p className="mt-2 text-xs text-[#657067]">No care assigned.</p>}
          </div>
          {member.userId === membership.userId ? <p className="w-full text-xs text-[#657067]">Your account · ask another manager to change your access.</p> : member.role === 'SUPER_ADMIN' ? <p className="w-full text-xs text-[#657067]">Owner access is protected.</p> : <MemberControls key={`${member.id}-${member.role}`} memberId={member.id} name={member.user.name || member.user.email} role={member.role} />}
        </li>)}
      </ul>
    </section>
  </>;
}
