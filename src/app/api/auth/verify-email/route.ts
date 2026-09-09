import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { COOKIE_NAME, signSession, SESSION_SECONDS } from '@/lib/auth';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Verification link is missing.' }, { status: 400 });
  // Validate signing configuration before consuming a one-time token. This
  // prevents a configuration error from verifying the account without a session.
  await signSession('verification-check', 0);
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) return NextResponse.json({ error: 'This verification link is invalid or expired.' }, { status: 400 });
  const user = await prisma.$transaction(async tx => {
    const consumed = await tx.emailVerificationToken.deleteMany({ where: { id: record.id, expiresAt: { gt: new Date() } } });
    if (!consumed.count) return null;
    return tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
  });
  if (!user) return NextResponse.json({ error: 'This verification link is invalid or expired.' }, { status: 400 });
  const session = await signSession(user.id, user.sessionVersion);
  const response = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  response.cookies.set(COOKIE_NAME, session, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: SESSION_SECONDS, path: '/' });
  return response;
}
