import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/session';

function cookieValue(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function POST(request: Request) {
  const session = await verifySession(cookieValue(request, COOKIE_NAME));
  if (session) {
    await prisma.user.updateMany({
      where: { id: session.userId, sessionVersion: session.sessionVersion },
      data: { sessionVersion: { increment: 1 } },
    });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, '', { httpOnly: true, expires: new Date(0), path: '/' });
  response.cookies.delete('reinwell_farm');
  return response;
}
