export const COOKIE_NAME = 'reinwell_session';
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();
async function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export type Session = { userId: string; sessionVersion: number };

export async function signSession(userId: string, sessionVersion: number) {
  const payload = `${userId}.${sessionVersion}.${Math.floor(Date.now() / 1000) + SESSION_SECONDS}`;
  const signature = await crypto.subtle.sign('HMAC', await key(), encoder.encode(payload));
  return `${payload}.${Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('')}`;
}
export async function verifySession(value: string | undefined) {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [id, version, expires, signature] = parts;
  if (!id || !/^\d+$/.test(version) || !/^\d+$/.test(expires) || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const sessionVersion = Number(version);
  const expiry = Number(expires);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 0 || !Number.isSafeInteger(expiry) || expiry <= now || expiry > now + SESSION_SECONDS) return null;
  try {
    const bytes = Uint8Array.from(signature.match(/../g)!, b => parseInt(b, 16));
    return await crypto.subtle.verify('HMAC', await key(), bytes, encoder.encode(`${id}.${version}.${expires}`)) ? { userId: id, sessionVersion } : null;
  } catch { return null; }
}
