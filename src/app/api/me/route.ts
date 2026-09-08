import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFarmAccess } from '@/lib/farm-access';
import { prisma } from '@/lib/prisma';
export async function GET() {
 const user = await getCurrentUser();
 if (!user) return NextResponse.json({ user: null }, { status: 401 });
 const memberships = await prisma.farmMember.findMany({ where: { userId: user.id, status: 'ACTIVE' }, include: { farm: { select: { id: true, name: true } } } });
 const access = await getFarmAccess();
 return NextResponse.json({ user: { name: user.name, email: user.email }, farm: 'error' in access ? null : { id: access.farmId, name: access.membership.farm.name }, farms: memberships.map(m => m.farm) });
}
