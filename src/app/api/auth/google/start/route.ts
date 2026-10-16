import { NextResponse } from 'next/server';
import { beginGoogleFlow, googleConfig, GOOGLE_FLOW_COOKIE } from '@/lib/google-oauth';
export async function POST(request: Request) {
  const config = googleConfig();
  if (!config || new URL(request.url).origin !== config.origin) return NextResponse.json({ error: 'Google sign-in is not available here yet.' }, { status: 503 });
  if (request.headers.get('origin') !== config.origin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.termsAccepted !== 'boolean') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const flow = await beginGoogleFlow(body.termsAccepted);
  const response = NextResponse.json({ url: flow.url }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(GOOGLE_FLOW_COOKIE, flow.cookie, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google', maxAge: 600 });
  return response;
}
