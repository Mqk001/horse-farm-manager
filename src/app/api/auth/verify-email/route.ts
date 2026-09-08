import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { COOKIE_NAME, signSession } from '@/lib/auth';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Verification link is missing.' }, { status: 400 });
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) return NextResponse.json({ error: 'This verification link is invalid or expired.' }, { status: 400 });
  const user = await prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
  await prisma.emailVerificationToken.delete({ where: { id: record.id } });
  const response = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  response.cookies.set(COOKIE_NAME, signSession(user.id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30, path: '/' });
  return response;
}
