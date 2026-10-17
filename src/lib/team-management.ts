import { prisma } from './prisma';
import { canManageFarm } from './permissions';

export class TeamError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function changeFarmMember({ farmId, actorId, memberId, role }: { farmId: string; actorId: string; memberId: string; role?: 'STAFF' | 'MANAGER' }) {
  return prisma.$transaction(async tx => {
    // Serialize access changes for this farm, including concurrent invitation
    // acceptance. Acquire the write lock before reading any membership state.
    await tx.farm.update({ where: { id: farmId }, data: { updatedAt: new Date() } });
    const actor = await tx.farmMember.findUnique({ where: { farmId_userId: { farmId, userId: actorId } } });
    if (actor?.status !== 'ACTIVE' || !canManageFarm(actor.role)) throw new TeamError('Only active farm managers can change team access.', 403);
    const member = await tx.farmMember.findFirst({ where: { id: memberId, farmId, status: 'ACTIVE' }, include: { user: { select: { email: true } } } });
    if (!member) throw new TeamError('Active farm member not found.', 404);
    if (member.userId === actorId) throw new TeamError('You cannot change your own farm access.', 403);
    if (member.role === 'SUPER_ADMIN') throw new TeamError('Owner access cannot be changed here.', 403);
    if (role === member.role) return { id: member.id, role: member.role, status: member.status };
    const result = await tx.farmMember.update({ where: { id: member.id }, data: role ? { role } : { status: 'REMOVED' }, select: { id: true, role: true, status: true } });
    // Old invitations must not restore removed access or become usable again
    // if a demoted inviter is later promoted.
    await tx.farmInvitation.updateMany({ where: { farmId, acceptedAt: null, declinedAt: null, OR: [{ email: member.user.email }, ...(!role || role === 'STAFF' ? [{ invitedById: member.userId }] : [])] }, data: { declinedAt: new Date() } });
    if (!role) await tx.vetItem.updateMany({ where: { assignedMemberId: member.id, horse: { farmId } }, data: { assignedMemberId: null } });
    return result;
  });
}
