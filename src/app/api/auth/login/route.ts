import { NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { COOKIE_NAME, signSession, SESSION_SECONDS } from '@/lib/auth';
import { clearLoginRateLimit, isLoginRateLimited, loginRateLimitKey, registerFailedLogin } from '@/lib/login-rate-limit';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.email !== 'string' || typeof body?.password !== 'string' || body.password.length > 128) return NextResponse.json({ error: 'Invalid email or password.' }, { status: 400 });
  const email = String(body.email).trim().toLowerCase();
  const { password } = body;
  const rateLimitKey = loginRateLimitKey(email, request);
  if (await isLoginRateLimited(rateLimitKey)) return NextResponse.json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' }, { status: 429 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(String(password), user.password))) {
    const locked = await registerFailedLogin(rateLimitKey);
    return NextResponse.json({ error: locked ? 'Too many sign-in attempts. Try again in 15 minutes.' : 'Invalid email or password.' }, { status: locked ? 429 : 401 });
  }
  await clearLoginRateLimit(rateLimitKey);
  if (!user.emailVerifiedAt) return NextResponse.json({ error: 'Verify your email before signing in.' }, { status: 403 });
  const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  response.cookies.set(COOKIE_NAME, await signSession(user.id, user.sessionVersion), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: SESSION_SECONDS, path: '/' });
  return response;
}
