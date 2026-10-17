import { verifySession } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const isPublic = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/invite', '/terms', '/privacy'].includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/api/auth');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin) {
      try {
        if (new URL(origin).host !== request.headers.get('host') || new URL(origin).protocol !== request.nextUrl.protocol) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
      } catch { return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 }); }
    }
  }
  const valid = await verifySession(request.cookies.get('reinwell_session')?.value);
  if (!isPublic && !valid) {
    if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
