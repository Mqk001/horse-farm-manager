import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/local-client';
import { unsubscribeToken, verifyUnsubscribeToken, validCronAuthorization, remindersAvailable, reminderOrigin } from '../src/lib/reminder-security';

async function main() {
  assert.ok(process.env.DATABASE_URL?.startsWith('file:/private/tmp/'));
  process.env.AUTH_SECRET = 'reinwell-reminder-test-disposable-secret';
  process.env.CRON_SECRET = 'reinwell-reminder-cron-disposable-secret';
  process.env.RESEND_API_KEY = 'test-only-not-real';
  process.env.EMAIL_FROM = 'Reinwell <reminders@example.test>';
  process.env.APP_URL = 'https://reinwell.example.test';
  process.env.CARE_REMINDERS_ENABLED = 'true';
  assert.ok(remindersAvailable());
  assert.ok(validCronAuthorization(`Bearer ${process.env.CRON_SECRET}`));
  for (const value of [null, '', 'Bearer bad', `bearer ${process.env.CRON_SECRET}`]) assert.equal(validCronAuthorization(value), false);
  const token = unsubscribeToken('member-1', 2);
  assert.deepEqual(verifyUnsubscribeToken(token), { memberId: 'member-1', version: 2 });
  assert.equal(verifyUnsubscribeToken(token.replace('member-1', 'member-2')), null);
  assert.equal(verifyUnsubscribeToken(token + 'f'), null);
  for (const url of ['http://evil.test', 'https://good.test/path', 'https://user:pass@good.test', 'https://good.test/?q=x']) {
    process.env.APP_URL = url; assert.equal(reminderOrigin(), null);
  }
  process.env.APP_URL = 'https://reinwell.example.test';
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  (globalThis as unknown as { prisma: unknown }).prisma = db;
  const { runCareReminders } = await import('../src/lib/care-reminders');
  const now = new Date(), midnight = new Date(now); midnight.setUTCHours(0,0,0,0);
  const date = (days: number) => new Date(midnight.getTime() + days * 86_400_000 + 12 * 3_600_000);
  const originalFetch = globalThis.fetch;
  const emails: { payload: any; key: string; body: string }[] = [];
  let fail = false;
  globalThis.fetch = async (_url, init) => {
    const body = String(init?.body);
    emails.push({ payload: JSON.parse(body), key: new Headers(init?.headers).get('Idempotency-Key')!, body });
    await new Promise(resolve => setTimeout(resolve, 20));
    return new Response('{}', { status: fail ? 503 : 200 });
  };
  const farms: string[] = [], users: string[] = [];
  try {
    const farm = await db.farm.create({ data: { name: '<img src=x> Farm', code: `reminders-${Date.now()}` } }); farms.push(farm.id);
    const other = await db.farm.create({ data: { name: 'Other Farm', code: `other-reminders-${Date.now()}` } }); farms.push(other.id);
    async function member(label: string, role: string, enabled = true, status = 'ACTIVE', verified = true, farmId = farm.id) {
      const user = await db.user.create({ data: { email: `${label}-${Date.now()}@example.test`, name: label, password: 'test-only', emailVerifiedAt: verified ? now : null } }); users.push(user.id);
      return db.farmMember.create({ data: { userId: user.id, farmId, role, careReminderEnabled: enabled, status }, include: { user: true } });
    }
    const manager = await member('manager', 'MANAGER'), staff = await member('staff', 'STAFF');
    await member('off', 'MANAGER', false); await member('removed', 'MANAGER', true, 'REMOVED'); await member('unverified', 'MANAGER', true, 'ACTIVE', false);
    const empty = await member('empty', 'STAFF');
    const horse = await db.horse.create({ data: { name: 'Thunder <script>', farmId: farm.id } });
    const retired = await db.horse.create({ data: { name: 'Retired', farmId: farm.id, status: 'RETIRED' } });
    const foreign = await db.horse.create({ data: { name: 'FOREIGN SECRET', farmId: other.id } });
    await db.vetItem.create({ data: { horseId: horse.id, itemType: 'VACCINE', itemName: 'STAFF OVERDUE', nextDueDate: date(-1), assignedMemberId: staff.id } });
    await db.vetItem.create({ data: { horseId: horse.id, itemType: 'OTHER', itemName: 'UNASSIGNED TODAY', nextDueDate: date(0) } });
    await db.vetItem.create({ data: { horseId: horse.id, itemType: 'OTHER', itemName: 'BOUNDARY INCLUDED', nextDueDate: new Date(midnight.getTime() + 4 * 86_400_000 - 1), assignedMemberId: staff.id } });
    await db.vetItem.create({ data: { horseId: horse.id, itemType: 'OTHER', itemName: 'TOO FAR', nextDueDate: new Date(midnight.getTime() + 4 * 86_400_000), assignedMemberId: staff.id } });
    await db.vetItem.create({ data: { horseId: retired.id, itemType: 'OTHER', itemName: 'RETIRED EXCLUDE', nextDueDate: date(0) } });
    await db.vetItem.create({ data: { horseId: foreign.id, itemType: 'OTHER', itemName: 'FOREIGN SECRET', nextDueDate: date(0) } });
    await db.vetItem.create({ data: { horseId: horse.id, itemType: 'OTHER', itemName: 'COMPLETED CARE', nextDueDate: null, lastDoneDate: now } });
    await db.farmTask.create({ data: { farmId: farm.id, title: 'STAFF FARM TASK', dueDate: date(1), assignedMemberId: staff.id } });
    await db.farmTask.create({ data: { farmId: farm.id, title: 'COMPLETED TASK', dueDate: date(-1), assignedMemberId: staff.id, completedAt: now } });
    await db.farmTask.create({ data: { farmId: farm.id, title: 'NO DUE DATE', assignedMemberId: staff.id } });
    const results = await Promise.all([runCareReminders(now), runCareReminders(now)]);
    assert.equal(results.reduce((sum, item) => sum + item.sent, 0), 2);
    assert.equal(emails.length, 2, 'Overlapping workers do not send duplicates');
    const staffMail = emails.find(item => item.payload.to[0] === staff.user.email)!.payload;
    const managerMail = emails.find(item => item.payload.to[0] === manager.user.email)!.payload;
    for (const payload of [staffMail, managerMail]) {
      for (const text of ['STAFF OVERDUE', 'BOUNDARY INCLUDED', 'STAFF FARM TASK', 'Overdue', 'Due soon', 'Turn them off:']) assert.ok(payload.text.includes(text));
      for (const text of ['FOREIGN SECRET', 'TOO FAR', 'RETIRED EXCLUDE', 'COMPLETED TASK', 'COMPLETED CARE', 'NO DUE DATE']) assert.ok(!payload.text.includes(text));
      assert.ok(!payload.html.includes('<img')); assert.ok(!payload.html.includes('<script>'));
      assert.ok(payload.html.includes('&lt;img'));
    }
    assert.ok(managerMail.text.includes('UNASSIGNED TODAY')); assert.ok(!staffMail.text.includes('UNASSIGNED TODAY'));
    assert.ok(managerMail.text.includes('Due today')); assert.ok(staffMail.text.includes('Your assigned'));
    assert.equal((await db.reminderDelivery.findUniqueOrThrow({ where: { memberId_day: { memberId: empty.id, day: now.toISOString().slice(0,10) } } })).status, 'SKIPPED');
    assert.equal((await runCareReminders(now)).sent, 0); assert.equal(emails.length, 2);
    // A failed request is retried with exactly the same payload and provider key.
    const retry = await member('retry', 'STAFF');
    await db.farmTask.create({ data: { farmId: farm.id, title: 'RETRY TASK', dueDate: date(0), assignedMemberId: retry.id } });
    fail = true; const failed = await runCareReminders(now); assert.equal(failed.failed, 1);
    const firstAttempt = emails.at(-1)!;
    fail = false;
    await db.reminderDelivery.updateMany({ where: { memberId: retry.id }, data: { leaseUntil: new Date(now.getTime() - 1) } });
    assert.equal((await runCareReminders(now)).sent, 1);
    assert.equal(emails.at(-1)!.body, firstAttempt.body); assert.equal(emails.at(-1)!.key, firstAttempt.key);
    // A role demotion must not deliver a queued manager-wide snapshot.
    await db.reminderDelivery.updateMany({ where: { memberId: manager.id }, data: { status: 'FAILED', attempts: 1, leaseUntil: null, payloadJson: JSON.stringify({ payload: managerMail, email: manager.user.email, version: 0, manager: true }) } });
    await db.farmMember.update({ where: { id: manager.id }, data: { role: 'STAFF' } });
    const count = emails.length; await runCareReminders(now); assert.equal(emails.length, count);
    // Expired idempotency windows never resend an uncertain delivery.
    await db.reminderDelivery.updateMany({ where: { memberId: retry.id }, data: { status: 'FAILED', attempts: 1, leaseUntil: null, createdAt: new Date(now.getTime() - 13 * 3_600_000), payloadJson: firstAttempt.body } });
    assert.equal((await runCareReminders(now)).failed, 1); assert.equal(emails.length, count);
    // Large schedules produce a bounded digest with an explicit full-list link.
    const large = await member('large', 'STAFF');
    await db.$transaction(Array.from({ length: 52 }, (_, index) => db.farmTask.create({ data: { farmId: farm.id, title: `BULK ${index}`, dueDate: date(0), assignedMemberId: large.id } })));
    assert.equal((await runCareReminders(now)).sent, 1);
    assert.equal((emails.at(-1)!.payload.html.match(/<li /g) ?? []).length, 50);
    assert.ok(emails.at(-1)!.payload.text.includes('Showing the first 50 items'));
    process.env.CARE_REMINDERS_ENABLED = 'false'; await assert.rejects(runCareReminders(now), /not configured/);
    console.log('PASS: signed opt-out/cron security, UTC boundaries, staff/manager/farm isolation, exclusions, empty digests, concurrent deduplication, stable retries, role revocation, expired retries and disabled configuration. All emails mocked.');
  } finally {
    globalThis.fetch = originalFetch;
    await db.farm.deleteMany({ where: { id: { in: farms } } }); await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
