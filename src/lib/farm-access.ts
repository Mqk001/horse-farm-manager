import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, verifySession } from './session';
import { loadFarmContext } from './farm-context-query';
import { prisma } from './prisma';
export async function getFarmContext() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(COOKIE_NAME)?.value);
  if (!session) return null;
  return loadFarmContext(prisma, session, cookieStore.get('reinwell_farm')?.value);
}
export async function getFarmAccess() {
  const context = await getFarmContext();
  if (!context) return { error: 'Sign in required.', status: 401 } as const;
  if (!context.membership) return { error: 'Select or create a farm.', status: 403 } as const;
  return { user: context.user, membership: context.membership, farmId: context.membership.farmId };
}
export async function requireFarm() {
  const access = await getFarmAccess();
  if ('error' in access) redirect(access.status === 401 ? '/login' : '/onboarding');
  return access;
}
