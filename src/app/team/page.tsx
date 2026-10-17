import { requireFarm } from '@/lib/farm-access';
import { prisma } from '@/lib/prisma';
import { MemberControls } from './MemberControls';
import TeamForm from './TeamForm';

export default async function TeamPage() {
  const { membership, farmId } = await requireFarm();
  if (!['MANAGER', 'SUPER_ADMIN'].includes(membership.role)) return <main className="page-shell"><h1 className="font-display text-4xl">Your team</h1><p className="mt-4">Only farm managers can invite team members.</p></main>;

  const members = await prisma.farmMember.findMany({
    where: { farmId, status: 'ACTIVE' },
    select: { id: true, userId: true, role: true, user: { select: { name: true, email: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  return <>
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
          {member.userId === membership.userId ? <p className="w-full text-xs text-[#657067]">Your account · ask another manager to change your access.</p> : member.role === 'SUPER_ADMIN' ? <p className="w-full text-xs text-[#657067]">Owner access is protected.</p> : <MemberControls key={`${member.id}-${member.role}`} memberId={member.id} name={member.user.name || member.user.email} role={member.role} />}
        </li>)}
      </ul>
    </section>
  </>;
}
