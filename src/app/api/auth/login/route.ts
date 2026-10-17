import { NextResponse } from 'next/server';
import { hashPassword, verifyPassword, isLegacyPasswordHash } from '@/lib/passwords';
import { prisma } from '@/lib/prisma';
import { COOKIE_NAME, signSession, SESSION_SECONDS } from '@/lib/auth';
import { clearLoginRateLimit, isLoginRateLimited, loginRateLimitKey, registerFailedLogin } from '@/lib/login-rate-limit';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.email !== 'string' || typeof body?.password !== 'string' || body.email.length > 254 || body.password.length > 128) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 400 });
  const email = String(body.email).trim().toLowerCase();
  const { password } = body;
  const rateLimitKey = loginRateLimitKey(email, request);
  if (await isLoginRateLimited(rateLimitKey)) return NextResponse.json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' }, { status: 429 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.password))) {
    const locked = await registerFailedLogin(rateLimitKey);
    return NextResponse.json({ error: locked ? 'Too many sign-in attempts. Try again in 15 minutes.' : 'Invalid email or password.' }, { status: locked ? 429 : 401 });
  }
  if (!user.emailVerifiedAt) return NextResponse.json({ error: 'Verify your email before signing in.' }, { status: 403 });
  if (isLegacyPasswordHash(user.password)) {
    const replacement = await hashPassword(password);
    // A concurrent reset/change must win over a login-time rehash.
    const upgraded = await prisma.user.updateMany({ where: { id: user.id, password: user.password, sessionVersion: user.sessionVersion, emailVerifiedAt: { not: null } }, data: { password: replacement } });
    if (upgraded.count !== 1) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }
  await clearLoginRateLimit(rateLimitKey);
  const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  response.cookies.set(COOKIE_NAME, await signSession(user.id, user.sessionVersion), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: SESSION_SECONDS, path: '/' });
  return response;
}
