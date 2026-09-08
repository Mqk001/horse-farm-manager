import { NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(80),
  email: z.string().trim().email('Enter a valid email address.').max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms and Conditions.' }) }),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Signup is unavailable until email delivery is configured.' }, { status: 503 });
  try {
    const parsed = signupSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check your details.' }, { status: 400 });

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });

  const user = await prisma.user.create({ data: { name, email, password: await bcrypt.hash(password, 12), role: 'STAFF', termsAcceptedAt: new Date() } });
  const token = randomBytes(32).toString('hex');
  await prisma.emailVerificationToken.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) } });
  const verificationUrl = `${new URL(request.url).origin}/verify-email?token=${token}`;
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email }, verificationUrl }, { status: 201 });
  } catch (error) {
    console.error('Signup failed:', error);
    return NextResponse.json({ error: 'We could not create your account. Please try again.' }, { status: 500 });
  }
}
