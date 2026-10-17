import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { issuePasswordReset, resetTokenHash, passwordResetOrigin } from '@/lib/password-reset';
import { sendPasswordResetEmail } from '@/lib/email';
import { isLoginRateLimited, registerFailedLogin } from '@/lib/login-rate-limit';

const schema = z.object({ email: z.string().trim().email().max(254).transform(value => value.toLowerCase()) });
export async function POST(request: Request) {
  const origin = passwordResetOrigin(request);
  if (!origin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Password recovery is temporarily unavailable. Please try again later.' }, { status: 503 });
  const { email } = parsed.data;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  // Independent account and IP limits prevent rotating either from bypassing both.
  for (const scope of [`email:${email}`, `ip:${ip}`]) {
    const key = createHash('sha256').update(`password-reset:${scope}`).digest('hex');
    if (await isLoginRateLimited(key) || await registerFailedLogin(key)) return NextResponse.json({ error: 'Too many requests. Try again in 15 minutes.' }, { status: 429 });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  // Recovery does not verify an account or bypass the signup verification flow.
  if (user?.emailVerifiedAt) {
    const token = await issuePasswordReset(user.id);
    try {
      await sendPasswordResetEmail({ to: email, name: user.name ?? 'there', resetUrl: `${origin}/reset-password#token=${token}` });
    } catch {
      await prisma.passwordResetToken.deleteMany({ where: { tokenHash: resetTokenHash(token) } });
      // Same response for delivery failure and unknown accounts. Never log tokens.
      console.error('Password reset email delivery failed.');
    }
  }
  return NextResponse.json({ ok: true });
}
