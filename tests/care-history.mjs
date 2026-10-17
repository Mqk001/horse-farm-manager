import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/local-client';
import bcrypt from 'bcryptjs';
const url = process.env.TEST_DATABASE_URL;
assert.ok(url?.startsWith('file:/private/tmp/'), 'Use a disposable SQLite database');
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3112';
const db = new PrismaClient({ datasources: { db: { url } } });
const suffix = Date.now();
const manifest = JSON.parse(await readFile(new URL('../.next/server/server-reference-manifest.json', import.meta.url), 'utf8'));
function actionId(name) {
  const entry = Object.entries(manifest.node).find(([, action]) => action.exportedName === name && action.filename === 'app/care/actions.ts');
  assert.ok(entry, `Compiled action ${name}`); return entry[0];
}
async function action(name, values, cookie) {
  const body = new FormData(); body.set('$ACTION_ID_' + actionId(name), '');
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  const response = await fetch(base + '/care', { method: 'POST', headers: { cookie, origin: base }, body });
  await response.text(); return response.status;
}
async function account(label, farmId, role) {
  const user = await db.user.create({ data: { email: `care-${suffix}-${label.toLowerCase()}@example.test`, name: label, password: await bcrypt.hash('Care-test-123', 10), emailVerifiedAt: new Date() } });
  const member = await db.farmMember.create({ data: { userId: user.id, farmId, role } });
  const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: base }, body: JSON.stringify({ email: user.email, password: 'Care-test-123' }) });
  assert.equal(response.status, 200); await response.text();
  return { user, member, cookie: response.headers.get('set-cookie').split(';')[0] + `; reinwell_farm=${farmId}` };
}
try {
  const farm = await db.farm.create({ data: { name: 'Care history test', code: `care-${suffix}` } });
  const other = await db.farm.create({ data: { name: 'Foreign care farm', code: `care-other-${suffix}` } });
  const manager = await account('Manager', farm.id, 'MANAGER');
  const staff = await account('Staff', farm.id, 'STAFF');
  const foreign = await account('Foreign', other.id, 'MANAGER');
  const horse = await db.horse.create({ data: { farmId: farm.id, name: 'History horse' } });
  const foreignHorse = await db.horse.create({ data: { farmId: other.id, name: 'Foreign care horse' } });
  const create = { horseId: horse.id, itemType: 'FARRIER', itemName: 'Recurring farrier', nextDueDate: '2026-10-14', intervalDays: '30', vetName: 'Test provider', notes: 'Original notes', assignedMemberId: staff.member.id };
  assert.equal(await action('createCareItem', { ...create, assignedMemberId: foreign.member.id }, manager.cookie), 500);
  assert.equal(await db.vetItem.count({ where: { horseId: horse.id } }), 0);
  for (const nextDueDate of ['2026-02-31', '2026-99-99', 'not-a-date']) assert.equal(await action('createCareItem', { ...create, nextDueDate }, manager.cookie), 500);
  assert.equal(await db.vetItem.count({ where: { horseId: horse.id } }), 0);
  assert.equal(await action('createCareItem', create, manager.cookie), 200);
  let item = await db.vetItem.findFirstOrThrow({ where: { horseId: horse.id } });
  assert.equal(item.assignedMemberId, staff.member.id);
  assert.equal(await action('assignCareItem', { id: item.id, assignedMemberId: manager.member.id }, staff.cookie), 500);
  assert.equal(await action('assignCareItem', { id: item.id, assignedMemberId: foreign.member.id }, manager.cookie), 500);
  await db.farmMember.update({ where: { id: staff.member.id }, data: { status: 'SUSPENDED' } });
  assert.equal(await action('assignCareItem', { id: item.id, assignedMemberId: staff.member.id }, manager.cookie), 500);
  await db.farmMember.update({ where: { id: staff.member.id }, data: { status: 'ACTIVE' } });
  const mine = await fetch(base + '/care?assigned=mine', { headers: { cookie: staff.cookie } });
  const mineHtml = await mine.text(); assert.ok(mineHtml.includes('Recurring farrier')); assert.ok(!mineHtml.includes('Foreign care horse'));
  const dashboardResponse = await fetch(base + '/dashboard', { headers: { cookie: staff.cookie } });
  assert.equal(dashboardResponse.status, 200);
  const dashboardHtml = await dashboardResponse.text();
  assert.ok(dashboardHtml.includes('My work'));
  assert.ok(dashboardHtml.indexOf('aria-label="My tasks"') < dashboardHtml.indexOf('aria-label="Quick activity"'));
  const tasksHtml = dashboardHtml.split('aria-label="My tasks"')[1].split('</section>')[0];
  assert.ok(tasksHtml.includes('Recurring farrier'));
  assert.ok(tasksHtml.includes('expectedDueDate'));
  assert.ok(!dashboardHtml.includes('Foreign care horse'));
  const managerDashboard = await fetch(base + '/dashboard', { headers: { cookie: manager.cookie } });
  const managerHtml = await managerDashboard.text();
  assert.ok(managerHtml.includes('Farm overview'));
  assert.ok(!managerHtml.split('aria-label="My tasks"')[1].split('</section>')[0].includes('Recurring farrier'));
  for (const [path, values] of [
    ['/api/rides', { riderName: 'Staff', rideType: 'FLAT', durationMinutes: 20 }],
    ['/api/washes', { type: 'GROOM_ONLY' }],
  ]) {
    const send = horseId => fetch(base + path, { method: 'POST', headers: { cookie: staff.cookie, origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ horseId, dateTime: new Date().toISOString(), ...values }) });
    assert.equal((await send(foreignHorse.id)).status, 404);
    assert.equal((await send(horse.id)).status, 200);
  }
  assert.equal(await db.rideLog.count({ where: { horseId: horse.id } }), 1);
  assert.equal(await db.washLog.count({ where: { horseId: horse.id } }), 1);
  const afterActivity = await (await fetch(base + '/dashboard', { headers: { cookie: staff.cookie } })).text();
  assert.ok(afterActivity.includes('GROOM ONLY'));
  assert.equal(await action('completeCareItem', { id: item.id }, foreign.cookie), 500);
  const expectedDueDate = item.nextDueDate.toISOString();
  const results = await Promise.all([action('completeCareItem', { id: item.id, expectedDueDate }, staff.cookie), action('completeCareItem', { id: item.id, expectedDueDate }, staff.cookie)]);
  assert.equal(results.filter(status => status === 200).length, 1);
  assert.equal(await db.careCompletion.count({ where: { careItemId: item.id } }), 1);
  let history = await db.careCompletion.findFirstOrThrow({ where: { careItemId: item.id } });
  assert.equal(history.completedByName, 'Staff'); assert.equal(history.itemName, 'Recurring farrier');
  const rescheduled = await db.vetItem.findUniqueOrThrow({ where: { id: item.id } });
  assert.ok(rescheduled.nextDueDate > rescheduled.lastDoneDate);
  await db.vetItem.update({ where: { id: item.id }, data: { itemName: 'Updated farrier', notes: 'Changed notes' } });
  assert.equal(await action('completeCareItem', { id: item.id, expectedDueDate }, manager.cookie), 500);
  assert.equal(await action('completeCareItem', { id: item.id, expectedDueDate: rescheduled.nextDueDate.toISOString() }, manager.cookie), 200);
  assert.equal(await db.careCompletion.count({ where: { careItemId: item.id } }), 2);
  history = await db.careCompletion.findUniqueOrThrow({ where: { id: history.id } });
  assert.equal(history.itemName, 'Recurring farrier'); assert.equal(history.notes, 'Original notes');
  const oldItem = await db.vetItem.create({ data: { horseId: horse.id, itemName: 'Legacy care', itemType: 'OTHER', lastDoneDate: new Date('2026-10-01'), nextDueDate: new Date('2026-10-14') } });
  assert.equal(await action('completeCareItem', { id: oldItem.id }, manager.cookie), 200);
  assert.equal(await db.careCompletion.count({ where: { careItemId: oldItem.id } }), 2);
  assert.equal(await db.careCompletion.count({ where: { careItemId: oldItem.id, legacy: true } }), 1);
  const oneOff = await db.vetItem.create({ data: { horseId: horse.id, itemName: 'One-off care', itemType: 'OTHER', nextDueDate: new Date() } });
  assert.equal(await action('completeCareItem', { id: oneOff.id }, manager.cookie), 200);
  assert.equal(await action('completeCareItem', { id: oneOff.id }, manager.cookie), 500);
  assert.equal(await db.careCompletion.count({ where: { careItemId: oneOff.id } }), 1);
  assert.equal(await action('assignCareItem', { id: item.id, assignedMemberId: '' }, manager.cookie), 200);
  assert.equal((await db.vetItem.findUniqueOrThrow({ where: { id: item.id } })).assignedMemberId, null);
  await db.vetItem.delete({ where: { id: oneOff.id } });
  assert.equal(await db.careCompletion.count({ where: { itemName: 'One-off care', horseId: horse.id, careItemId: null } }), 1);
  const timeline = await fetch(base + `/horses/${horse.id}?kind=care`, { headers: { cookie: manager.cookie } });
  const html = await timeline.text(); assert.ok(html.includes('Recurring farrier')); assert.ok(html.includes('Updated farrier')); assert.ok(html.includes('Recorded by Staff'));
  assert.equal(await db.careCompletion.count({ where: { horseId: foreignHorse.id } }), 0);
  console.log('PASS: assignment permissions/isolation, my tasks, concurrent/replayed completion denial, recurring and one-off history, snapshots, legacy preservation, rendered timeline');
} finally { await db.$disconnect(); }
