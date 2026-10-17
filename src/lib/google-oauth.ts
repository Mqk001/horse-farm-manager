import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { OAuth2Client, CodeChallengeMethod, type TokenPayload } from 'google-auth-library';
import { MemoryCache } from './memory-cache';
import { DependencyCircuit } from './dependency-circuit';

const googleCertificates = new MemoryCache<Awaited<ReturnType<OAuth2Client['getFederatedSignonCertsAsync']>>>(2);

function certificateTtl(result: Awaited<ReturnType<OAuth2Client['getFederatedSignonCertsAsync']>>) {
  const control = result.res?.headers.get('cache-control') ?? '';
  if (/no-store|no-cache/i.test(control)) return 0;
  const seconds = Number(/(?:^|,)\s*max-age=(\d+)/i.exec(control)?.[1] ?? 0);
  const age = Number(result.res?.headers.get('age') ?? 0);
  return Math.max(0, Math.min(3600000, (seconds - (Number.isFinite(age) ? age : 0)) * 1000));
}

class GoogleTransportError extends Error {
  constructor() { super('Google sign-in transport is unavailable'); }
}
const googleCircuit = new DependencyCircuit({ name: 'Google sign-in', timeoutMs: 5000, maxConcurrent: 4, failureThreshold: 3, cooldownMs: 30000, isFailure: error => error instanceof GoogleTransportError });


export const GOOGLE_FLOW_COOKIE = 'reinwell_google_flow';
const MAX_AGE_SECONDS = 600;
export type GoogleFlow = { state: string; nonce: string; verifier: string; origin: string; termsAccepted: boolean; expiresAt: number };

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = process.env.GOOGLE_AUTH_ORIGIN ?? 'https://getreinwell.com';
  if (!clientId || !clientSecret) return null;
  const parsed = new URL(origin);
  if (parsed.origin !== origin || (parsed.protocol !== 'https:' && !(['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.protocol === 'http:'))) throw new Error('Invalid Google auth origin');
  return { clientId, clientSecret, origin, redirectUri: `${origin}/api/auth/google/callback` };
}
function signature(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('Auth secret is unavailable');
  return createHmac('sha256', secret).update(`reinwell-google-v1:${value}`).digest('base64url');
}
export function encodeGoogleFlow(flow: GoogleFlow) {
  const payload = Buffer.from(JSON.stringify(flow)).toString('base64url');
  return `${payload}.${signature(payload)}`;
}
export function decodeGoogleFlow(cookie: string | undefined, expectedState: string | null, origin: string): GoogleFlow | null {
  if (!cookie || cookie.length > 3000 || !expectedState) return null;
  const [payload, received, extra] = cookie.split('.');
  if (!payload || !received || extra) return null;
  const expected = signature(payload);
  if (received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return null;
  try {
    const flow: GoogleFlow = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (flow.state !== expectedState || flow.origin !== origin || typeof flow.termsAccepted !== 'boolean' || !Number.isSafeInteger(flow.expiresAt) || flow.expiresAt <= Date.now() || flow.expiresAt > Date.now() + MAX_AGE_SECONDS * 1000 || !/^[a-f0-9]{64}$/.test(flow.nonce) || !/^[a-f0-9]{64}$/.test(flow.state) || typeof flow.verifier !== 'string' || flow.verifier.length < 43 || flow.verifier.length > 128) return null;
    return flow;
  } catch { return null; }
}
export async function beginGoogleFlow(termsAccepted: boolean) {
  const config = googleConfig();
  if (!config) throw new Error('Google sign-in is unavailable');
  const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const flow: GoogleFlow = { state: randomBytes(32).toString('hex'), nonce: randomBytes(32).toString('hex'), verifier: codeVerifier, origin: config.origin, termsAccepted, expiresAt: Date.now() + MAX_AGE_SECONDS * 1000 };
  const url = client.generateAuthUrl({ scope: ['openid', 'email', 'profile'], state: flow.state, nonce: flow.nonce, code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256, prompt: 'select_account' });
  return { url, cookie: encodeGoogleFlow(flow) };
}
export async function verifyGoogleCode(code: string, flow: GoogleFlow) {
  const config = googleConfig();
  if (!config) throw new Error('Google sign-in is unavailable');
  return googleCircuit.run(async signal => {
    const client = new OAuth2Client({ clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri });
    // Enforce options at request time: SDK methods otherwise override retry defaults.
    const originalRequest = client.transporter.request.bind(client.transporter);
    client.transporter.request = async options => {
      try { return await originalRequest({ ...options, signal, timeout: 5000, retry: false }); }
      catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) throw error;
        throw new GoogleTransportError();
      }
    };
    const fetchCertificates = client.getFederatedSignonCertsAsync.bind(client);
    client.getFederatedSignonCertsAsync = () => googleCertificates.read('google:oauth-signing-certificates:v1', fetchCertificates, certificateTtl);
    const { tokens } = await client.getToken({ code, codeVerifier: flow.verifier, redirect_uri: config.redirectUri });
    if (!tokens.id_token) throw new Error('Missing Google identity');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
    const payload = ticket.getPayload() as (TokenPayload & { nonce?: string }) | undefined;
    if (!payload || payload.nonce !== flow.nonce || !payload.sub || !payload.email || payload.email_verified !== true) throw new Error('Invalid Google identity');
    return { subject: payload.sub, email: payload.email.trim().toLowerCase(), name: payload.name?.slice(0, 100) ?? null, authoritativeEmail: payload.email.toLowerCase().endsWith('@gmail.com') || Boolean(payload.hd) };
  });
}
