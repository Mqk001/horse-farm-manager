import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendFarmInvitationEmail } from '@/lib/email';
import { getFarmAccess } from '@/lib/farm-access';
import { prisma } from '@/lib/prisma';

const schema = z.object({ email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()), role: z.enum(['STAFF', 'MANAGER']) });

export async function POST(request: Request) {
  const access = await getFarmAccess();
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!['MANAGER', 'SUPER_ADMIN'].includes(access.membership.role)) return NextResponse.json({ error: 'Only farm managers can invite team members.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the invitation details.' }, { status: 400 });
  if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Invitations are temporarily unavailable.' }, { status: 503 });
  const { email, role } = parsed.data;
  const existingUser = await prisma.user.findUnique({ where: { email } });
  const member = existingUser ? await prisma.farmMember.findUnique({ where: { farmId_userId: { farmId: access.farmId, userId: existingUser.id } } }) : null;
  if (member?.status === 'ACTIVE') return NextResponse.json({ error: 'This person already belongs to the farm.' }, { status: 409 });
  const token = randomBytes(32).toString('hex');
  const invitation = await prisma.farmInvitation.create({ data: { farmId: access.farmId, email, role, invitedById: access.user.id, inviteeId: existingUser?.id, token, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
  const invitationUrl = `${new URL(request.url).origin}/invite#token=${encodeURIComponent(token)}`;
  try { if (process.env.NODE_ENV === 'production') await sendFarmInvitationEmail({ to: email, farmName: access.membership.farm.name, role, invitationUrl }); }
  catch (error) { await prisma.farmInvitation.delete({ where: { id: invitation.id } }).catch(() => undefined); console.error('Invitation email failed:', error); return NextResponse.json({ error: 'We could not send the invitation. Please try again.' }, { status: 502 }); }
  return NextResponse.json({ invitation: { id: invitation.id, email, role, expiresAt: invitation.expiresAt }, ...(process.env.NODE_ENV !== 'production' ? { invitationUrl } : {}) }, { status: 201 });
}
