import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { COOKIE_NAME, verifySession } from './session';
export { COOKIE_NAME, signSession, SESSION_SECONDS } from './session';
export async function getCurrentUser() {
  const session = await verifySession(cookies().get(COOKIE_NAME)?.value);
  const user = session ? await prisma.user.findFirst({ where: { id: session.userId, sessionVersion: session.sessionVersion } }) : null;
  return user?.emailVerifiedAt ? user : null;
}
