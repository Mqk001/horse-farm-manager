import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in with the invited email address first.' }, { status: 401 });
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Invitation link is missing.' }, { status: 400 });
  const invitation = await prisma.farmInvitation.findUnique({ where: { token } });
  if (!invitation || invitation.expiresAt < new Date() || invitation.acceptedAt || invitation.declinedAt) return NextResponse.json({ error: 'This invitation is invalid or expired.' }, { status: 400 });
  if (invitation.email !== user.email) return NextResponse.json({ error: 'Sign in with the email address this invitation was sent to.' }, { status: 403 });
  await prisma.$transaction([prisma.farmMember.upsert({ where: { farmId_userId: { farmId: invitation.farmId, userId: user.id } }, create: { farmId: invitation.farmId, userId: user.id, role: invitation.role, status: 'ACTIVE' }, update: { role: invitation.role, status: 'ACTIVE' } }), prisma.farmInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date(), inviteeId: user.id } })]);
  const response = NextResponse.json({ ok: true, farmId: invitation.farmId }); response.cookies.set('reinwell_farm', invitation.farmId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }); return response;
}
