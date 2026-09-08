import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
export async function POST(request: Request) {
 const user = await getCurrentUser();
 if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
 const body = await request.json().catch(() => null);
 if (typeof body?.farmId !== 'string') return NextResponse.json({ error: 'Choose a farm.' }, { status: 400 });
 const membership = await prisma.farmMember.findFirst({ where: { userId: user.id, farmId: body.farmId, status: 'ACTIVE' } });
 if (!membership) return NextResponse.json({ error: 'Farm unavailable.' }, { status: 403 });
 const response = NextResponse.json({ ok: true });
 response.cookies.set('reinwell_farm', membership.farmId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
 return response;
}
