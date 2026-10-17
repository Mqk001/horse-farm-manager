import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/local-client';
assert.ok(process.env.TEST_DATABASE_URL?.startsWith('file:/private/tmp/'), 'Disposable database required');
const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3187';
const suffix = Date.now();
async function call(path, method, body, cookie = '', origin = base) {
  const r = await fetch(base + path, { method, headers: { origin, cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: r.status, data: await r.json().catch(() => null) };
}
async function account(label, farmId, role) {
  const user = await db.user.create({ data: { email: `team-${suffix}-${label}@example.test`, name: label, password: await bcrypt.hash('Team-test-password', 4), emailVerifiedAt: new Date() } });
  const member = await db.farmMember.create({ data: { userId: user.id, farmId, role } });
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: base }, body: JSON.stringify({ email: user.email, password: 'Team-test-password' }) });
  assert.equal(r.status, 200);
  return { user, member, cookie: r.headers.get('set-cookie').split(';')[0] + `; reinwell_farm=${farmId}` };
}
async function invitation(farmId, invitedById, email) {
  return db.farmInvitation.create({ data: { farmId, invitedById, email, role: 'MANAGER', token: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 86400000) } });
}
try {
  const farm = await db.farm.create({ data: { name: 'Team management test', code: `team-${suffix}` } });
  const other = await db.farm.create({ data: { name: 'Other team test', code: `other-team-${suffix}` } });
  const manager = await account('manager', farm.id, 'MANAGER');
  const staff = await account('staff', farm.id, 'STAFF');
  const owner = await account('owner', farm.id, 'SUPER_ADMIN');
  const foreign = await account('foreign', other.id, 'MANAGER');
  await db.farmMember.create({ data: { userId: staff.user.id, farmId: other.id, role: 'STAFF' } });
  const path = id => `/api/team/${id}`;
  assert.equal((await call(path(staff.member.id), 'PATCH', { role: 'MANAGER' })).status, 401);
  assert.equal((await call(path(manager.member.id), 'PATCH', { role: 'STAFF' }, staff.cookie)).status, 403);
  assert.equal((await call(path(staff.member.id), 'PATCH', { role: 'SUPER_ADMIN' }, manager.cookie)).status, 400);
  assert.equal((await call(path(staff.member.id), 'PATCH', { role: 'MANAGER', farmId: other.id }, manager.cookie)).status, 400);
  assert.equal((await call(path(foreign.member.id), 'DELETE', undefined, manager.cookie)).status, 404);
  for (const member of [owner.member, manager.member]) for (const method of ['PATCH', 'DELETE']) assert.equal((await call(path(member.id), method, method === 'PATCH' ? { role: 'STAFF' } : undefined, manager.cookie)).status, 403);
  assert.equal((await call(path(staff.member.id), 'PATCH', { role: 'MANAGER' }, manager.cookie, 'https://foreign.example')).status, 403);
  assert.equal((await call(path(staff.member.id), 'PATCH', { role: 'MANAGER' }, manager.cookie, '')).status, 403);
  assert.equal((await call(path(staff.member.id), 'PATCH', { role: 'MANAGER' }, manager.cookie)).status, 200);
  assert.equal((await db.farmMember.findUnique({ where: { id: staff.member.id } })).role, 'MANAGER');
  const issued = await invitation(farm.id, staff.user.id, 'future@example.test');
  assert.equal((await call(path(staff.member.id), 'PATCH', { role: 'STAFF' }, manager.cookie)).status, 200);
  assert.ok((await db.farmInvitation.findUnique({ where: { id: issued.id } })).declinedAt);
  assert.equal((await call(path(manager.member.id), 'DELETE', undefined, staff.cookie)).status, 403);
  const horse = await db.horse.create({ data: { name: 'Assignment fixture', farmId: farm.id } });
  const care = await db.vetItem.create({ data: { horseId: horse.id, itemName: 'Team care', itemType: 'OTHER', assignedMemberId: staff.member.id, nextDueDate: new Date() } });
  const old = await invitation(farm.id, manager.user.id, staff.user.email);
  const race = await Promise.all([call('/api/invitations/accept', 'POST', { token: old.token }, staff.cookie), call(path(staff.member.id), 'DELETE', undefined, manager.cookie)]);
  assert.equal(race[1].status, 200);
  assert.ok([200, 400, 403].includes(race[0].status));
  assert.equal((await db.farmMember.findUnique({ where: { id: staff.member.id } })).status, 'REMOVED');
  assert.equal((await db.vetItem.findUnique({ where: { id: care.id } })).assignedMemberId, null);
  const denied = await call('/api/rides', 'POST', { horseId: horse.id }, staff.cookie);
  assert.equal(denied.status, 403);
  assert.equal((await db.farmMember.findUnique({ where: { farmId_userId: { farmId: other.id, userId: staff.user.id } } })).status, 'ACTIVE');
  assert.equal((await call('/api/invitations/accept', 'POST', { token: old.token }, staff.cookie)).status, 400);
  assert.equal((await call(path(staff.member.id), 'DELETE', undefined, manager.cookie)).status, 404);
  const a = await account('race-a', farm.id, 'MANAGER');
  const b = await account('race-b', farm.id, 'MANAGER');
  const results = await Promise.all([call(path(b.member.id), 'PATCH', { role: 'STAFF' }, a.cookie), call(path(a.member.id), 'PATCH', { role: 'STAFF' }, b.cookie)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 403]);
  const page = await fetch(base + '/team', { headers: { cookie: manager.cookie } });
  const html = await page.text();
  assert.ok(html.includes('Save role') && html.includes('Owner access is protected.') && html.includes('Your account'));
  console.log('PASS: real HTTP team changes, staff/foreign/owner/self protections, strict roles/origins, immediate access loss, assignment cleanup, invite revocation, concurrent removal/acceptance and competing manager demotions');
} finally { await db.$disconnect(); }
