import { createHash } from 'node:crypto';
import { prisma } from './prisma';

export async function teamRevision(farmId: string) {
  const state = await Promise.all([
    prisma.farmTask.aggregate({ where: { farmId }, _count: true, _max: { updatedAt: true } }),
    prisma.vetItem.aggregate({ where: { horse: { farmId } }, _count: true, _max: { updatedAt: true } }),
    prisma.careCompletion.aggregate({ where: { horse: { farmId } }, _count: true, _max: { completedAt: true, dismissedAt: true } }),
    prisma.farmMember.aggregate({ where: { farmId }, _count: true, _max: { updatedAt: true } }),
  ]);
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}
