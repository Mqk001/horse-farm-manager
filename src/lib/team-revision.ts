import { MemoryCache } from './memory-cache';
import { loadTeamRevision } from './team-revision-query';
import { prisma } from './prisma';

const revisions = new MemoryCache<string>(128);
export function invalidateTeamRevision(farmId: string) { revisions.delete(`team-revision:${farmId}`); }
export function teamRevision(farmId: string) {
  return revisions.read(`team-revision:${farmId}`, () => loadTeamRevision(prisma, farmId), 2000);
}
