import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const isPublic = ['/login', '/signup', '/verify-email', '/terms', '/privacy'].includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/api/auth');
  if (!isPublic && !request.cookies.has('reinwell_session')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if ((request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup' || request.nextUrl.pathname === '/verify-email') && request.cookies.has('reinwell_session')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
