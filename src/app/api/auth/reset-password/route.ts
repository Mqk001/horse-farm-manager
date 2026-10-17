import { NextResponse } from 'next/server';
import { resetPassword, resetPasswordSchema, passwordResetOrigin } from '@/lib/password-reset';
import { COOKIE_NAME } from '@/lib/session';
export async function POST(request: Request) {
  const origin = passwordResetOrigin(request);
  if (!origin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = resetPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Use a valid reset link and a password of 8–128 characters.' }, { status: 400 });
  if (!await resetPassword(parsed.data.token, parsed.data.password)) return NextResponse.json({ error: 'This reset link is invalid or expired. Request a new one.' }, { status: 400 });
  const response = NextResponse.json({ ok: true });
  for (const name of [COOKIE_NAME, 'reinwell_farm']) response.cookies.set(name, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
