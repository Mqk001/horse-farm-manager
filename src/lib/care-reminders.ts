import { randomBytes } from 'node:crypto';
import { prisma } from './prisma';
import { canManageFarm } from './permissions';
import { startOfDay, careStatus, displayDate } from './care-dates';
import { careReminderEmail, sendCareReminder, type ReminderEmailPayload } from './email';
import { reminderOrigin, remindersAvailable, unsubscribeToken } from './reminder-security';

const DAY = 86_400_000;
const include = { user: { select: { email: true, emailVerifiedAt: true } }, farm: { select: { name: true } } } as const;
type Member = NonNullable<Awaited<ReturnType<typeof getMember>>>;
function getMember(id: string) { return prisma.farmMember.findUnique({ where: { id }, include }); }
function eligible(member: Awaited<ReturnType<typeof getMember>>) {
  return member && member.status === 'ACTIVE' && member.careReminderEnabled && Boolean(member.user.emailVerifiedAt);
}

async function buildDigest(member: Member, now: Date) {
  const manager = canManageFarm(member.role);
  // Today plus the next three calendar days, using the same UTC dates as Care.
  const before = new Date(startOfDay(now).getTime() + 4 * DAY);
  const assignment = manager ? {} : { assignedMemberId: member.id };
  const [care, tasks] = await Promise.all([
    prisma.vetItem.findMany({ where: { horse: { farmId: member.farmId, status: { not: 'RETIRED' } }, nextDueDate: { lt: before }, ...assignment },
      select: { id: true, itemName: true, nextDueDate: true, horse: { select: { id: true, name: true } }, assignedMember: { select: { farmId: true, status: true, user: { select: { name: true, email: true } } } } },
      orderBy: [{ nextDueDate: 'asc' }, { id: 'asc' }], take: 51 }),
    prisma.farmTask.findMany({ where: { farmId: member.farmId, completedAt: null, dueDate: { lt: before }, ...assignment },
      select: { id: true, title: true, dueDate: true, assignedMember: { select: { farmId: true, status: true, user: { select: { name: true, email: true } } } } },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], take: 51 }),
  ]);
  const origin = reminderOrigin()!;
  const assigned = (value: typeof care[number]['assignedMember']) => value?.status === 'ACTIVE' && value.farmId === member.farmId ? `Assigned to ${value.user.name ?? value.user.email}` : 'Unassigned';
  const items = [
    ...care.map(item => ({ title: `${item.horse.name} · ${item.itemName}`, date: item.nextDueDate!, assignee: assigned(item.assignedMember), url: `${origin}/horses/${encodeURIComponent(item.horse.id)}` })),
    ...tasks.map(item => ({ title: item.title, date: item.dueDate!, assignee: assigned(item.assignedMember), url: `${origin}/dashboard` })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  if (!items.length) return null;
  return careReminderEmail({ to: member.user.email, farmName: member.farm.name, day: now.toISOString().slice(0, 10), manager,
    more: items.length > 50, items: items.slice(0, 50).map(item => ({ ...item, due: displayDate(item.date), status: { overdue: 'Overdue', today: 'Due today', upcoming: 'Due soon' }[careStatus(item.date, now)] })),
    workspaceUrl: `${origin}/${manager ? 'care' : 'dashboard'}`,
    unsubscribeUrl: `${origin}/reminders/unsubscribe?token=${unsubscribeToken(member.id, member.reminderVersion)}`,
  });
}

async function deliverToMember(memberId: string, now: Date, send: typeof sendCareReminder) {
  const day = now.toISOString().slice(0, 10);
  const member = await getMember(memberId);
  if (!eligible(member)) return 'skipped';
  let record = await prisma.reminderDelivery.findUnique({ where: { memberId_day: { memberId, day } } });
  if (!record) {
    const payload = await buildDigest(member!, now);
    try {
      record = await prisma.reminderDelivery.create({ data: { memberId, day, status: payload ? 'PENDING' : 'SKIPPED', payloadJson: payload ? JSON.stringify({ payload, email: member!.user.email, version: member!.reminderVersion, manager: canManageFarm(member!.role) }) : null } });
    } catch (error) {
      // Another worker may have created this member/day while we prepared it.
      record = await prisma.reminderDelivery.findUnique({ where: { memberId_day: { memberId, day } } });
      if (!record) throw error;
    }
  }
  if (record.status === 'SENT' || record.status === 'SKIPPED') return 'skipped';
  // Never retry beyond Resend's 24-hour idempotency window, even after a crash.
  if (record.createdAt.getTime() < now.getTime() - 12 * 60 * 60 * 1000 || record.attempts >= 3) {
    // Do not expire a third attempt that is still in flight on another worker.
    if (record.leaseUntil && record.leaseUntil >= now) return 'skipped';
    await prisma.reminderDelivery.updateMany({ where: { id: record.id, status: { in: ['PENDING', 'FAILED'] }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
      data: { status: 'EXPIRED', payloadJson: null, leaseToken: null, leaseUntil: null } });
    return 'failed';
  }
  const leaseToken = randomBytes(16).toString('hex');
  const claimed = await prisma.reminderDelivery.updateMany({ where: { id: record.id, status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: 3 }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: { leaseToken, leaseUntil: new Date(now.getTime() + 5 * 60 * 1000), attempts: { increment: 1 }, status: 'PENDING' } });
  if (!claimed.count) return 'skipped';
  const claim = { id: record.id, leaseToken };
  try {
    const current = await getMember(memberId);
    // Check again after claiming: revoked access, opt-out, role/email changes must
    // not receive a previously prepared digest with broader or different scope.
    if (!eligible(current) || current!.role !== member!.role || current!.user.email !== member!.user.email || current!.reminderVersion !== member!.reminderVersion) {
      await prisma.reminderDelivery.updateMany({ where: claim, data: { status: 'SKIPPED', payloadJson: null, leaseUntil: null, leaseToken: null } });
      return 'skipped';
    }
    const snapshot = JSON.parse(record.payloadJson!) as { payload: ReminderEmailPayload; email: string; version: number; manager: boolean };
    if (snapshot.email !== current!.user.email || snapshot.version !== current!.reminderVersion || snapshot.manager !== canManageFarm(current!.role)) {
      await prisma.reminderDelivery.updateMany({ where: claim, data: { status: 'SKIPPED', payloadJson: null, leaseUntil: null, leaseToken: null } });
      return 'skipped';
    }
    await send(snapshot.payload, `care-digest-v1/${record.id}`);
    await prisma.reminderDelivery.updateMany({ where: claim, data: { status: 'SENT', sentAt: new Date(), payloadJson: null, leaseUntil: null, leaseToken: null } });
    return 'sent';
  } catch {
    // Keep the exact payload/key for safe retry; do not log recipient data/tokens.
    await prisma.reminderDelivery.updateMany({ where: claim, data: { status: 'FAILED', leaseUntil: new Date(now.getTime() + 60_000), leaseToken: null } });
    return 'failed';
  }
}

export async function runCareReminders(now = new Date()) {
  if (!remindersAvailable()) throw new Error('Care reminders are not configured');
  const result = { sent: 0, skipped: 0, failed: 0, incomplete: false };
  const deadline = Date.now() + 240_000;
  const day = now.toISOString().slice(0, 10);
  let cursor: string | undefined;
  let nextSendAt = 0;
  const send: typeof sendCareReminder = async (payload, key) => {
    // Leave headroom under Resend's default two-requests-per-second rate limit.
    const wait = nextSendAt - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    nextSendAt = Date.now() + 600;
    await sendCareReminder(payload, key);
  };
  // Bounded batches and sequential sending stay below the email concurrency cap.
  for (let processed = 0; processed < 1000;) {
    const members = await prisma.farmMember.findMany({ where: { status: 'ACTIVE', careReminderEnabled: true, user: { emailVerifiedAt: { not: null } },
      reminderDeliveries: { none: { day, status: { in: ['SENT', 'SKIPPED', 'EXPIRED'] } } }, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true }, orderBy: { id: 'asc' }, take: 25 });
    if (!members.length) break;
    for (const member of members) {
      if (Date.now() >= deadline) { result.incomplete = true; return result; }
      try { result[await deliverToMember(member.id, now, send)]++; }
      catch { result.failed++; }
      processed++; cursor = member.id;
    }
    if (processed >= 1000) result.incomplete = true;
  }
  await prisma.reminderDelivery.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 30 * DAY) } } });
  return result;
}
