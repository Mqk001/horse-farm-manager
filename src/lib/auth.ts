import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const COOKIE_NAME = 'reinwell_session';
const secret = () => process.env.AUTH_SECRET || 'development-only-change-me';

export function signSession(userId: string) {
  const signature = createHmac('sha256', secret()).update(userId).digest('hex');
  return `${userId}.${signature}`;
}

function verifySession(value: string | undefined) {
  if (!value) return null;
  const [userId, signature] = value.split('.');
  if (!userId || !signature) return null;
  const expected = createHmac('sha256', secret()).update(userId).digest('hex');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return userId;
}

export async function getCurrentUser() {
  const userId = verifySession(cookies().get(COOKIE_NAME)?.value);
  return userId ? prisma.user.findUnique({ where: { id: userId } }) : null;
}

export { COOKIE_NAME };
