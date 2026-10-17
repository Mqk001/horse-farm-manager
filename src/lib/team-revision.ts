import { MemoryCache } from './memory-cache';
import { createHash } from 'node:crypto';
import { prisma } from './prisma';

const revisions = new MemoryCache<string>(128);
export function invalidateTeamRevision(farmId: string) { revisions.delete(`team-revision:${farmId}`); }
export function teamRevision(farmId: string) {
  return revisions.read(`team-revision:${farmId}`, () => loadTeamRevision(farmId), 2000);
}

async function loadTeamRevision(farmId: string) {
  const state = await Promise.all([
    prisma.farmTask.aggregate({ where: { farmId }, _count: true, _max: { updatedAt: true } }),
    prisma.vetItem.aggregate({ where: { horse: { farmId } }, _count: true, _max: { updatedAt: true } }),
    prisma.careCompletion.aggregate({ where: { horse: { farmId } }, _count: true, _max: { completedAt: true, dismissedAt: true } }),
    prisma.farmMember.aggregate({ where: { farmId }, _count: true, _max: { updatedAt: true } }),
  ]);
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}
