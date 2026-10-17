import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { prisma } from '../src/lib/prisma';
import { resolveGoogleAccount, GoogleAccountError } from '../src/lib/google-account';
import { signSession } from '../src/lib/session';
assert.ok(process.env.DATABASE_URL?.startsWith('file:/private/tmp/'), 'Disposable SQLite required');
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3187';
const suffix = Date.now();
async function cookie(user: { id: string; sessionVersion: number }) { return `reinwell_session=${await signSession(user.id, user.sessionVersion)}`; }
async function accept(token: string, session = '') {
  return fetch(base + '/api/invitations/accept', { method: 'POST', headers: { origin: base, cookie: session, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
}
async function main() {
  const manager = await prisma.user.create({ data: { email: `google-inviter-${suffix}@example.test`, password: 'fixture-only', emailVerifiedAt: new Date() } });
  const farm = await prisma.farm.create({ data: { name: 'Google invitation fixture', code: `gi-${suffix}`, memberships: { create: { userId: manager.id, role: 'MANAGER' } } } });
  const identity = { subject: `invited-google-${suffix}`, email: `invited-${suffix}@gmail.com`, name: 'Invited Google fixture', authoritativeEmail: true };
  const invite = await prisma.farmInvitation.create({ data: { farmId: farm.id, invitedById: manager.id, email: identity.email, role: 'STAFF', token: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 86400000) } });
  assert.equal((await accept(invite.token)).status, 401);
  await assert.rejects(resolveGoogleAccount(identity, false), (error: unknown) => error instanceof GoogleAccountError && error.code === 'terms_required');
  assert.equal((await prisma.farmInvitation.findUniqueOrThrow({ where: { id: invite.id } })).acceptedAt, null);
  const user = await resolveGoogleAccount(identity, true);
  assert.equal(await prisma.farmMember.count({ where: { userId: user.id } }), 0);
  const session = await cookie(user);
  assert.equal((await accept(invite.token, await cookie(manager))).status, 403);
  const response = await accept(invite.token, session);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).farmId, farm.id);
  assert.ok(response.headers.get('set-cookie')?.includes('reinwell_farm=' + farm.id));
  assert.equal((await prisma.farmMember.findUniqueOrThrow({ where: { farmId_userId: { farmId: farm.id, userId: user.id } } })).role, 'STAFF');
  assert.equal((await accept(invite.token, session)).status, 400);
  const again = await resolveGoogleAccount(identity, false);
  assert.equal(again.id, user.id);
  const secondFarm = await prisma.farm.create({ data: { name: 'Second invited fixture', code: `gi-second-${suffix}`, memberships: { create: { userId: manager.id, role: 'MANAGER' } } } });
  const second = await prisma.farmInvitation.create({ data: { farmId: secondFarm.id, invitedById: manager.id, email: identity.email, role: 'STAFF', token: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 86400000) } });
  assert.equal((await accept(second.token, session)).status, 200);
  assert.equal(await prisma.farmMember.count({ where: { userId: user.id, status: 'ACTIVE' } }), 2);
  console.log('PASS: Google identity + real invitation HTTP, terms gate, no default farm/elevation, correct email/farm/role, replay denial and existing memberships preserved');
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
