import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  const membership = await prisma.farmMember.findFirst({ where: { userId: user.id, status: 'ACTIVE' }, include: { farm: { select: { id: true, name: true, code: true } } } });
  return NextResponse.json({ user: { name: user.name, email: user.email }, farm: membership?.farm ?? null });
}
