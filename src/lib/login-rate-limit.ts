import { createHash } from 'crypto';
import { prisma } from './prisma';

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function loginRateLimitKey(email: string, request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwardedFor || request.headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(`${email}\n${ip}`).digest('hex');
}

export async function isLoginRateLimited(key: string) {
  const entry = await prisma.loginRateLimit.findUnique({ where: { key } });
  return Boolean(entry?.lockedUntil && entry.lockedUntil > new Date());
}

export async function registerFailedLogin(key: string) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const entry = await tx.loginRateLimit.findUnique({ where: { key } });
    const withinWindow = entry && now.getTime() - entry.windowStartedAt.getTime() < WINDOW_MS;
    const attempts = withinWindow ? entry.attempts + 1 : 1;
    const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + WINDOW_MS) : null;

    if (entry) {
      await tx.loginRateLimit.update({
        where: { key },
        data: { attempts, windowStartedAt: withinWindow ? entry.windowStartedAt : now, lockedUntil },
      });
    } else {
      await tx.loginRateLimit.create({ data: { key, attempts, windowStartedAt: now, lockedUntil } });
    }
    return Boolean(lockedUntil);
  });
}

export function clearLoginRateLimit(key: string) {
  return prisma.loginRateLimit.deleteMany({ where: { key } });
}
