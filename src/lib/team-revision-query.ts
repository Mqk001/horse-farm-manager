import { Prisma, type PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

type Stamp = Date | string | number | bigint | null;
type Row = { kind: string; count: number | bigint; updated: Stamp; dismissed: Stamp };
function date(value: Stamp) {
  if (value === null || value instanceof Date) return value;
  if (typeof value === 'string' && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) value = `${value.replace(' ', 'T')}Z`;
  return new Date(typeof value === 'bigint' ? Number(value) : value);
}
export function teamRevisionQuery(farmId: string) {
  return Prisma.sql`SELECT 'completion' AS kind, COUNT(*) AS count, MAX(c."completedAt") AS updated, MAX(c."dismissedAt") AS dismissed FROM "CareCompletion" c JOIN "Horse" h ON h.id = c."horseId" WHERE h."farmId" = ${farmId}
    UNION ALL SELECT 'task', COUNT(*), MAX("updatedAt"), NULL FROM "FarmTask" WHERE "farmId" = ${farmId}
    UNION ALL SELECT 'care', COUNT(*), MAX(v."updatedAt"), NULL FROM "VetItem" v JOIN "Horse" h ON h.id = v."horseId" WHERE h."farmId" = ${farmId}
    UNION ALL SELECT 'member', COUNT(*), MAX("updatedAt"), NULL FROM "FarmMember" WHERE "farmId" = ${farmId}`;
}
export async function loadTeamRevision(db: Pick<PrismaClient, '$queryRaw'>, farmId: string) {
  const rows = await db.$queryRaw<Row[]>(teamRevisionQuery(farmId));
  // Preserve the existing fingerprint exactly, including nulls and UTC dates.
  const state = ['task', 'care', 'completion', 'member'].map(kind => {
    const row = rows.find(row => row.kind === kind)!;
    return { _count: Number(row.count), _max: kind === 'completion'
      ? { completedAt: date(row.updated), dismissedAt: date(row.dismissed) }
      : { updatedAt: date(row.updated) } };
  });
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}
