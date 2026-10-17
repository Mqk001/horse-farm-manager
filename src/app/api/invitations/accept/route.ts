import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

class InvitationError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in with the invited email address first.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const token = body?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({ error: 'Invitation link is invalid.' }, { status: 400 });
  const invitation = await prisma.farmInvitation.findUnique({ where: { token } });
  if (!invitation || invitation.expiresAt <= new Date() || invitation.acceptedAt || invitation.declinedAt) return NextResponse.json({ error: 'This invitation is invalid or expired.' }, { status: 400 });
  if (invitation.email !== user.email) return NextResponse.json({ error: 'Sign in with the email address this invitation was sent to.' }, { status: 403 });
  try {
  const result = await prisma.$transaction(async tx => {
    // Serialize with team access changes before reading membership state.
    await tx.farm.update({ where: { id: invitation.farmId }, data: { updatedAt: new Date() } });
    // Claim and membership change commit atomically.
    const consumed = await tx.farmInvitation.updateMany({ where: { id: invitation.id, acceptedAt: null, declinedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date(), inviteeId: user.id } });
    if (!consumed.count) throw new InvitationError('This invitation is invalid or expired.', 400);
    const inviter = await tx.farmMember.findUnique({ where: { farmId_userId: { farmId: invitation.farmId, userId: invitation.invitedById } } });
    if (inviter?.status !== 'ACTIVE' || !['MANAGER', 'SUPER_ADMIN'].includes(inviter.role)) throw new InvitationError('This invitation is no longer available. Ask a farm manager for a new invitation.', 403);
    const member = await tx.farmMember.findUnique({ where: { farmId_userId: { farmId: invitation.farmId, userId: user.id } } });
    if (member && member.status !== 'ACTIVE' && invitation.createdAt <= member.updatedAt) throw new InvitationError('This invitation predates your membership removal. Ask for a new invitation.', 403);
    // An older invitation must never change an existing active member's role.
    if (member?.status !== 'ACTIVE') await tx.farmMember.upsert({ where: { farmId_userId: { farmId: invitation.farmId, userId: user.id } }, create: { farmId: invitation.farmId, userId: user.id, role: invitation.role, status: 'ACTIVE' }, update: { role: invitation.role, status: 'ACTIVE' } });
    return { farmId: invitation.farmId };
  });
  const response = NextResponse.json({ ok: true, farmId: result.farmId });
  response.cookies.set('reinwell_farm', result.farmId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  return response;
  } catch (error) {
    if (error instanceof InvitationError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
