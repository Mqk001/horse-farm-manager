import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendVerificationEmail } from '@/lib/email';
import { isLoginRateLimited, registerFailedLogin } from '@/lib/login-rate-limit';
import { prisma } from '@/lib/prisma';

const requestSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});

function resendRateLimitKey(email: string, request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';
  return createHash('sha256').update(`resend-verification\\n${email}\\n${ip}`).digest('hex');
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email verification is temporarily unavailable. Please try again later.' }, { status: 503 });

  const { email } = parsed.data;
  const key = resendRateLimitKey(email, request);
  if (await isLoginRateLimited(key)) return NextResponse.json({ error: 'Too many requests. Try again in 15 minutes.' }, { status: 429 });
  const locked = await registerFailedLogin(key);
  if (locked) return NextResponse.json({ error: 'Too many requests. Try again in 15 minutes.' }, { status: 429 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt) return NextResponse.json({ ok: true });

  const token = randomBytes(32).toString('hex');
  const verificationUrl = `${new URL(request.url).origin}/verify-email#token=${encodeURIComponent(token)}`;
  try {
    if (process.env.NODE_ENV === 'production') await sendVerificationEmail({ to: user.email, name: user.name ?? 'there', verificationUrl });
    await prisma.$transaction([
      prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
      prisma.emailVerificationToken.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } }),
    ]);
  } catch (error) {
    console.error('Verification email resend failed:', error);
    return NextResponse.json({ error: 'We could not send the verification email. Please try again.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
