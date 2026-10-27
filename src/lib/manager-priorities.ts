import { Prisma, type PrismaClient } from '@prisma/client';

export const PRIORITY_GROUPS = ['overdueCare', 'overdueFarm', 'unassignedCare', 'unassignedFarm', 'reviewCare', 'reviewFarm'] as const;
export type PriorityGroup = typeof PRIORITY_GROUPS[number];
type DateValue = Date | string | number | bigint;
export type PriorityRow = {
  category: PriorityGroup; id: string; title: string; horseId: string | null;
  horseName: string | null; date: Date; by: string | null; notes: string | null;
  product: string | null; costCents: number | null; costCurrency: string | null;
};
type RawRow = Omit<PriorityRow, 'date' | 'costCents'> & { date: DateValue; costCents: number | bigint | null; total: number | bigint; position: number | bigint };

// One fresh, parameterized read. Window totals include every matching row, while
// each category sends at most five records back to the application. No user data
// is cached or shared between requests. Call only after manager authorization.
export function managerPrioritiesQuery(farmId: string, today: Date) {
  return Prisma.sql`WITH
    "overdueCare" AS (
      SELECT 'overdueCare' AS category, v.id, v."itemName" AS title, v."horseId", h.name AS "horseName", v."nextDueDate" AS date,
        NULL AS "by", NULL AS notes, NULL AS product, CAST(NULL AS INTEGER) AS "costCents", NULL AS "costCurrency", COUNT(*) OVER () AS total,
        ROW_NUMBER() OVER (ORDER BY v."nextDueDate", v.id) AS position
      FROM "VetItem" v JOIN "Horse" h ON h.id = v."horseId"
      WHERE h."farmId" = ${farmId} AND v."nextDueDate" < ${today}
      ORDER BY v."nextDueDate", v.id LIMIT 5
    ), "overdueFarm" AS (
      SELECT 'overdueFarm' AS category, f.id, f.title, NULL AS "horseId", NULL AS "horseName", f."dueDate" AS date,
        NULL AS "by", NULL AS notes, NULL AS product, CAST(NULL AS INTEGER) AS "costCents", NULL AS "costCurrency", COUNT(*) OVER () AS total,
        ROW_NUMBER() OVER (ORDER BY f."dueDate", f.id) AS position
      FROM "FarmTask" f WHERE f."farmId" = ${farmId} AND f."completedAt" IS NULL AND f."dueDate" < ${today}
      ORDER BY f."dueDate", f.id LIMIT 5
    ), "unassignedCare" AS (
      SELECT 'unassignedCare' AS category, v.id, v."itemName" AS title, v."horseId", h.name AS "horseName", v."nextDueDate" AS date,
        NULL AS "by", NULL AS notes, NULL AS product, CAST(NULL AS INTEGER) AS "costCents", NULL AS "costCurrency", COUNT(*) OVER () AS total,
        ROW_NUMBER() OVER (ORDER BY v."nextDueDate", v.id) AS position
      FROM "VetItem" v JOIN "Horse" h ON h.id = v."horseId"
      WHERE h."farmId" = ${farmId} AND v."nextDueDate" IS NOT NULL AND v."assignedMemberId" IS NULL
      ORDER BY v."nextDueDate", v.id LIMIT 5
    ), "unassignedFarm" AS (
      SELECT 'unassignedFarm' AS category, f.id, f.title, NULL AS "horseId", NULL AS "horseName", f."createdAt" AS date,
        NULL AS "by", NULL AS notes, NULL AS product, CAST(NULL AS INTEGER) AS "costCents", NULL AS "costCurrency", COUNT(*) OVER () AS total,
        ROW_NUMBER() OVER (ORDER BY f."createdAt", f.id) AS position
      FROM "FarmTask" f WHERE f."farmId" = ${farmId} AND f."completedAt" IS NULL AND f."assignedMemberId" IS NULL
      ORDER BY f."createdAt", f.id LIMIT 5
    ), "reviewCare" AS (
      SELECT 'reviewCare' AS category, c.id, c."itemName" AS title, c."horseId", h.name AS "horseName", c."completedAt" AS date,
        c."completedByName" AS "by", c."completionNotes" AS notes, c."productUsed" AS product, c."costCents", c."costCurrency", COUNT(*) OVER () AS total,
        ROW_NUMBER() OVER (ORDER BY c."completedAt" DESC, c.id) AS position
      FROM "CareCompletion" c JOIN "Horse" h ON h.id = c."horseId"
      WHERE h."farmId" = ${farmId} AND c."dismissedAt" IS NULL
      ORDER BY c."completedAt" DESC, c.id LIMIT 5
    ), "reviewFarm" AS (
      SELECT 'reviewFarm' AS category, f.id, f.title, NULL AS "horseId", NULL AS "horseName", f."completedAt" AS date,
        f."completedByName" AS "by", NULL AS notes, NULL AS product, CAST(NULL AS INTEGER) AS "costCents", NULL AS "costCurrency", COUNT(*) OVER () AS total,
        ROW_NUMBER() OVER (ORDER BY f."completedAt" DESC, f.id) AS position
      FROM "FarmTask" f WHERE f."farmId" = ${farmId} AND f."completedAt" IS NOT NULL AND f."dismissedAt" IS NULL
      ORDER BY f."completedAt" DESC, f.id LIMIT 5
    )
    SELECT * FROM "overdueCare" UNION ALL SELECT * FROM "overdueFarm"
    UNION ALL SELECT * FROM "unassignedCare" UNION ALL SELECT * FROM "unassignedFarm"
    UNION ALL SELECT * FROM "reviewCare" UNION ALL SELECT * FROM "reviewFarm"
    ORDER BY category, position`;
}

export async function loadManagerPriorities(db: Pick<PrismaClient, '$queryRaw'>, farmId: string, today: Date) {
  const rows = await db.$queryRaw<RawRow[]>(managerPrioritiesQuery(farmId, today));
  const totals = Object.fromEntries(PRIORITY_GROUPS.map(group => [group, 0])) as Record<PriorityGroup, number>;
  const groups: Record<PriorityGroup, PriorityRow[]> = { overdueCare: [], overdueFarm: [], unassignedCare: [], unassignedFarm: [], reviewCare: [], reviewFarm: [] };
  for (const row of rows) {
    totals[row.category] = Number(row.total);
    // PostgreSQL timestamp-without-time-zone values represent UTC in this app.
    // Prisma returns Date; drivers returning a bare timestamp must not apply
    // the application server's local timezone when converting it.
    const value = typeof row.date === 'string' && !/(Z|[+-]\d{2}:?\d{2})$/i.test(row.date) ? `${row.date.replace(' ', 'T')}Z` : row.date;
    const date = value instanceof Date ? value : new Date(typeof value === 'bigint' ? Number(value) : value);
    const { total: _total, position: _position, ...record } = row;
    groups[row.category].push({ ...record, date, costCents: row.costCents === null ? null : Number(row.costCents) });
  }
  return { totals, groups };
}
