import { createHmac, timingSafeEqual } from 'node:crypto';

export function reminderOrigin() {
  try {
    const url = new URL(process.env.APP_URL ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

export function remindersAvailable() {
  return process.env.CARE_REMINDERS_ENABLED === 'true' && Boolean(reminderOrigin()) &&
    Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) &&
    (process.env.AUTH_SECRET?.length ?? 0) >= 32 && (process.env.CRON_SECRET?.length ?? 0) >= 32;
}

export function validCronAuthorization(value: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !value) return false;
  const expected = Buffer.from(`Bearer ${secret}`), supplied = Buffer.from(value);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

// Separate HMAC purpose from session signing. A preference change revokes old links.
export function unsubscribeToken(memberId: string, version: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('Reminder signing is not configured');
  const payload = `${memberId}.${version}`;
  return `${payload}.${createHmac('sha256', secret).update(`care-reminder-unsubscribe:v1:${payload}`).digest('hex')}`;
}

export function verifyUnsubscribeToken(token: string) {
  if (token.length > 220) return null;
  const match = /^([a-zA-Z0-9_-]{1,100})\.(\d{1,10})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return null;
  const version = Number(match[2]);
  try {
    const expected = Buffer.from(unsubscribeToken(match[1], version));
    const actual = Buffer.from(token);
    return expected.length === actual.length && timingSafeEqual(expected, actual) ? { memberId: match[1], version } : null;
  } catch { return null; }
}
