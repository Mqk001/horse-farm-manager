import { NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { COOKIE_NAME, signSession } from '@/lib/auth';

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
  if (!user || !(await bcrypt.compare(String(password), user.password))) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }
  const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  response.cookies.set(COOKIE_NAME, signSession(user.id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30, path: '/' });
  return response;
}
