import { Prisma, type PrismaClient } from '@prisma/client';
import type { Session } from './session';

type Row = {
  actorId: string; actorName: string | null; actorEmail: string;
  id: string | null; farmId: string | null; userId: string | null; role: string | null; status: string | null;
  careReminderLeadDays: number | null; careReminderHourUTC: number | null;
  careReminderEnabled: boolean | number | null; reminderVersion: number | null;
  farmName: string | null;
};

// Fresh authorization and active memberships in one snapshot/round trip. A
// verified user with no active memberships still produces a row via LEFT JOIN.
// Never cache this result across requests or accept a farm without membership.
export function farmContextQuery(session: Session) {
  return Prisma.sql`SELECT u.id AS "actorId", u.name AS "actorName", u.email AS "actorEmail",
    m.id, m."farmId", m."userId", m.role, m.status,
    m."careReminderLeadDays", m."careReminderHourUTC", m."careReminderEnabled", m."reminderVersion",
    f.name AS "farmName"
    FROM "User" u
    LEFT JOIN "FarmMember" m ON m."userId" = u.id AND m.status = 'ACTIVE'
    LEFT JOIN "Farm" f ON f.id = m."farmId"
    WHERE u.id = ${session.userId} AND u."sessionVersion" = ${session.sessionVersion}
      AND u."emailVerifiedAt" IS NOT NULL
    ORDER BY m.id ASC`;
}

export async function loadFarmContext(db: Pick<PrismaClient, '$queryRaw'>, session: Session, selected?: string) {
  const rows = await db.$queryRaw<Row[]>(farmContextQuery(session));
  if (!rows.length) return null;
  const user = { id: rows[0].actorId, name: rows[0].actorName, email: rows[0].actorEmail };
  const memberships = rows.filter(row => row.id !== null).map(row => ({
    id: row.id!, farmId: row.farmId!, userId: row.userId!, role: row.role!, status: row.status!,
    careReminderLeadDays: Number(row.careReminderLeadDays), careReminderHourUTC: Number(row.careReminderHourUTC),
    careReminderEnabled: Boolean(row.careReminderEnabled), reminderVersion: Number(row.reminderVersion),
    farm: { id: row.farmId!, name: row.farmName! },
  }));
  const membership = selected ? memberships.find(member => member.farmId === selected) : memberships.length === 1 ? memberships[0] : undefined;
  return { user, memberships, membership };
}
