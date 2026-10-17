import assert from 'node:assert/strict';
import * as bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { issuePasswordReset } from '../src/lib/password-reset';
assert.ok(process.env.DATABASE_URL?.startsWith('file:/private/tmp/reinwell-password-'));
const base = 'http://127.0.0.1:3187';
const post = (path: string, body: unknown, origin = base) => fetch(`${base}${path}`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function main() {
  const email = `http-${Date.now()}@example.test`;
  const user = await prisma.user.create({ data: { email, password: await bcrypt.hash('before-reset', 4), emailVerifiedAt: new Date() } });
  const login = await post('/api/auth/login', { email, password: 'before-reset' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await fetch(`${base}/api/me`, { headers: { cookie } })).status, 200);
  const token = await issuePasswordReset(user.id);
  assert.equal((await post('/api/auth/reset-password', { token, password: 'after-reset' }, 'https://foreign.example')).status, 403);
  const reset = await post('/api/auth/reset-password', { token, password: 'after-reset' });
  assert.equal(reset.status, 200);
  assert.ok(reset.headers.get('set-cookie')?.includes('Max-Age=0'));
  assert.equal((await post('/api/auth/reset-password', { token, password: 'after-reset' })).status, 400);
  assert.equal((await fetch(`${base}/api/me`, { headers: { cookie } })).status, 401);
  assert.equal((await post('/api/auth/login', { email, password: 'before-reset' })).status, 401);
  assert.equal((await post('/api/auth/login', { email, password: 'after-reset' })).status, 200);
  assert.equal((await post('/api/auth/forgot-password', { email })).status, 503);
  for (const path of ['/forgot-password', '/reset-password']) assert.equal((await fetch(`${base}${path}`)).status, 200);
  console.log('PASS: real production HTTP login/reset/replay, old-session rejection, old/new password checks, cleared cookies, foreign origin, fail-closed email configuration and public pages');
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
