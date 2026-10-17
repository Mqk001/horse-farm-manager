import assert from 'node:assert/strict';
import * as bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { issuePasswordReset, resetPassword, resetTokenHash } from '../src/lib/password-reset';
import { POST as forgot } from '../src/app/api/auth/forgot-password/route';
import { POST as reset } from '../src/app/api/auth/reset-password/route';

assert.ok(process.env.DATABASE_URL?.startsWith('file:/private/tmp/reinwell-password-'), 'Disposable test database required');
const origin = 'http://localhost:3187';
const request = (path: string, body: unknown, requestOrigin = origin) => new Request(`${origin}/api/auth/${path}`, { method: 'POST', headers: { origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function main() {
  const user = await prisma.user.create({ data: { email: 'reset@example.test', name: '<Reset>', password: await bcrypt.hash('old-password', 4), emailVerifiedAt: new Date(), googleSubject: 'reset-google-subject' } });
  const farm = await prisma.farm.create({ data: { name: 'Reset test farm', code: 'password-reset-test', memberships: { create: { userId: user.id, role: 'MANAGER' } } } });
  const token = await issuePasswordReset(user.id);
  const stored = await prisma.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: resetTokenHash(token) } });
  assert.notEqual(stored.tokenHash, token);
  assert.ok(stored.expiresAt.getTime() - Date.now() <= 30 * 60 * 1000);
  assert.equal(await resetPassword(token, 'short'), false);
  await prisma.passwordResetToken.update({ where: { id: stored.id }, data: { expiresAt: new Date(Date.now() - 1) } });
  assert.equal(await resetPassword(token, 'new-password'), false);
  const rotated = await issuePasswordReset(user.id);
  assert.equal(await resetPassword(token, 'new-password'), false);
  const results = await Promise.all([resetPassword(rotated, 'new-password'), resetPassword(rotated, 'new-password')]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await resetPassword(rotated, 'another-password'), false);
  const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(updated.sessionVersion, 1);
  assert.ok(await bcrypt.compare('new-password', updated.password));
  assert.equal(await bcrypt.compare('old-password', updated.password), false);
  assert.equal(updated.googleSubject, 'reset-google-subject');
  assert.equal((await prisma.farmMember.findUniqueOrThrow({ where: { farmId_userId: { farmId: farm.id, userId: user.id } } })).role, 'MANAGER');
  const stale = await issuePasswordReset(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  assert.equal(await resetPassword(stale, 'stale-password'), false);
  console.log('PASS: hashing, expiry, rotation, concurrent consumption, replay, password replacement, session revocation, stale-session token denial, farm/Google preservation');

  delete process.env.RESEND_API_KEY;
  assert.equal((await forgot(request('forgot-password', { email: user.email }))).status, 503);
  process.env.RESEND_API_KEY = 'disposable-test-key';
  let mail: any;
  let failDelivery = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => { mail = JSON.parse(String(init?.body)); return new Response('{}', { status: failDelivery ? 403 : 200 }); };
  try {
    assert.equal((await forgot(request('forgot-password', { email: user.email }, 'https://foreign.example'))).status, 403);
    assert.equal((await forgot(request('forgot-password', { email: 'bad' }))).status, 400);
    const known = await forgot(request('forgot-password', { email: user.email.toUpperCase() }));
    const unknown = await forgot(request('forgot-password', { email: 'absent@example.test' }));
    assert.deepEqual(await known.json(), await unknown.json());
    assert.ok(mail.html.includes('&lt;Reset&gt;'));
    assert.equal(mail.to[0], user.email);
    const deliveredToken = /#token=([a-f0-9]{64})/.exec(mail.text)![1];
    assert.equal((await reset(request('reset-password', { token: deliveredToken, password: 'final-password' }))).status, 200);
    assert.equal((await reset(request('reset-password', { token: deliveredToken, password: 'final-password' }))).status, 400);
    assert.equal((await reset(request('reset-password', { token: deliveredToken, password: 'final-password' }, 'https://foreign.example'))).status, 403);
    const unverified = await prisma.user.create({ data: { email: 'unverified@example.test', password: 'fixture' } });
    await forgot(request('forgot-password', { email: unverified.email }));
    assert.equal(await prisma.passwordResetToken.count({ where: { userId: unverified.id } }), 0);
    failDelivery = true;
    assert.equal((await forgot(request('forgot-password', { email: user.email }))).status, 200);
    assert.equal(await prisma.passwordResetToken.count({ where: { userId: user.id } }), 0);
    let limited = false;
    for (let i = 0; i < 6; i++) if ((await forgot(request('forgot-password', { email: `absent-${i}@example.test` }))).status === 429) limited = true;
    assert.ok(limited);
  } finally { globalThis.fetch = originalFetch; }
  console.log('PASS: route validation/origin checks, generic responses, mocked email content/delivery, unverified-account denial, delivery-failure cleanup and IP throttling');
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
