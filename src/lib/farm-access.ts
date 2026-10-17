import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from './auth';
import { prisma } from './prisma';
export async function getFarmContext() {
  const user = await getCurrentUser();
  if (!user) return null;
  const selected = (await cookies()).get('reinwell_farm')?.value;
  const memberships = await prisma.farmMember.findMany({ where: { userId: user.id, status: 'ACTIVE' }, include: { farm: true }, orderBy: { id: 'asc' } });
  const membership = selected ? memberships.find(m => m.farmId === selected) : memberships.length === 1 ? memberships[0] : undefined;
  return { user, memberships, membership };
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
