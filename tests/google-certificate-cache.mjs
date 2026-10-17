import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mock } from 'node:test';
import { createRequire } from 'node:module';
const { Gaxios } = createRequire(import.meta.url)('gaxios');
import { beginGoogleFlow, decodeGoogleFlow, verifyGoogleCode } from '../src/lib/google-oauth.ts';
assert.ok(process.env.AUTH_SECRET?.startsWith('reinwell-google-test-'));
const started = await beginGoogleFlow(false);
const flow = decodeGoogleFlow(started.cookie, new URL(started.url).searchParams.get('state'), process.env.GOOGLE_AUTH_ORIGIN);
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const now = Math.floor(Date.now() / 1000);
const payload = { iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, sub: 'cached-key-fixture', email: 'fixture@gmail.com', email_verified: true, nonce: flow.nonce, iat: now - 10, exp: now + 3600 };
const unsigned = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url') + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
const token = unsigned + '.' + sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
let certificateReads = 0, tokenExchanges = 0;
const control = process.env.TEST_CERT_CACHE_CONTROL ?? 'public, max-age=60';
mock.method(Gaxios.prototype, 'request', async options => {
  if (options.method === 'POST') { tokenExchanges++; return { data: { id_token: token } }; }
  certificateReads++;
  return { data: { fixture: publicKey.export({ type: 'spki', format: 'pem' }) }, headers: new Headers({ 'cache-control': control }) };
});
try {
  for (let i = 0; i < 4; i++) assert.equal((await verifyGoogleCode('fixture-code', flow)).subject, payload.sub);
  assert.equal(tokenExchanges, 4, 'OAuth token exchanges must never be cached');
  assert.equal(certificateReads, /no-store|no-cache|max-age=0/.test(control) ? 4 : 1);
  console.log(`PASS: four independently verified OAuth exchanges; ${certificateReads} public certificate fetch(es), cache-control=${control}; actual SDK JWT verification, mocked transport`);
} finally { mock.restoreAll(); }
