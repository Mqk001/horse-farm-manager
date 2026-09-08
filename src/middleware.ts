import { verifySession } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const isPublic = ['/login', '/signup', '/verify-email', '/terms', '/privacy'].includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/api/auth');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== request.headers.get('host')) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const valid = await verifySession(request.cookies.get('reinwell_session')?.value);
  if (!isPublic && !valid) {
    if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
