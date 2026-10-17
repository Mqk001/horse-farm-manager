import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Gaxios } from 'gaxios';
import { sendVerificationEmail, sendFarmInvitationEmail, sendPasswordResetEmail } from '../src/lib/email';
import { beginGoogleFlow, decodeGoogleFlow, verifyGoogleCode } from '../src/lib/google-oauth';
import { DependencyUnavailableError } from '../src/lib/dependency-circuit';
async function main() {
  const originalFetch = globalThis.fetch;
  const saved = { RESEND_API_KEY: process.env.RESEND_API_KEY, GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET, GOOGLE_AUTH_ORIGIN: process.env.GOOGLE_AUTH_ORIGIN, AUTH_SECRET: process.env.AUTH_SECRET };
  try {
    Object.assign(process.env, { RESEND_API_KEY: 'test-only-key', GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-secret', GOOGLE_AUTH_ORIGIN: 'http://localhost:3187', AUTH_SECRET: 'reinwell-google-test-disposable-secret' });
    let emailCalls = 0;
    const finishes: (() => void)[] = [];
    globalThis.fetch = async (_url, init) => {
      emailCalls++;
      assert.ok(init?.signal instanceof AbortSignal);
      await new Promise<void>(resolve => finishes.push(resolve));
      return new Response('{}');
    };
    const send = () => sendVerificationEmail({ to: 'fixture@example.test', name: 'Fixture', verificationUrl: 'https://example.test/verify' });
    const pending = Array.from({ length: 4 }, send);
    await Promise.resolve();
    await assert.rejects(send(), (e: unknown) => e instanceof DependencyUnavailableError && e.reason === 'busy');
    assert.equal(emailCalls, 4);
    finishes.forEach(finish => finish());
    await Promise.all(pending);
    globalThis.fetch = async () => { emailCalls++; return new Response('{}', { status: 503 }); };
    for (let i = 0; i < 3; i++) await assert.rejects(send());
    await assert.rejects(sendFarmInvitationEmail({ to: 'fixture@example.test', farmName: 'Fixture', role: 'STAFF', invitationUrl: 'https://example.test/invite' }), DependencyUnavailableError);
    await assert.rejects(sendPasswordResetEmail({ to: 'fixture@example.test', name: 'Fixture', resetUrl: 'https://example.test/reset' }), DependencyUnavailableError);
    assert.equal(emailCalls, 7); // Shared breaker across all email templates.

    const started = await beginGoogleFlow(false);
    const flow = decodeGoogleFlow(started.cookie, new URL(started.url).searchParams.get('state'), 'http://localhost:3187')!;
    let googleCalls = 0;
    let status = 400;
    mock.method(Gaxios.prototype, 'request', async (options: { signal: AbortSignal; timeout: number; retry: boolean }) => {
      googleCalls++;
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.timeout, 5000);
      assert.equal(options.retry, false);
      throw Object.assign(new Error('simulated provider'), { response: { status } });
    });
    // Invalid grants don't open the Google circuit; email outage doesn't block it.
    for (let i = 0; i < 4; i++) await assert.rejects(verifyGoogleCode('fixture', flow));
    assert.equal(googleCalls, 4);
    status = 503;
    for (let i = 0; i < 3; i++) await assert.rejects(verifyGoogleCode('fixture', flow));
    await assert.rejects(verifyGoogleCode('fixture', flow), DependencyUnavailableError);
    assert.equal(googleCalls, 7);
    console.log('PASS: real email wrapper concurrency/shared opening; real Google transport timeout, abort signal, retry suppression, error classification and opening; independent provider circuits. No external calls.');
  } finally {
    globalThis.fetch = originalFetch;
    mock.restoreAll();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
