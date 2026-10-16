import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decodeGoogleFlow, googleConfig, GOOGLE_FLOW_COOKIE, verifyGoogleCode } from '@/lib/google-oauth';
import { GoogleAccountError, resolveGoogleAccount } from '@/lib/google-account';
import { COOKIE_NAME, signSession, SESSION_SECONDS } from '@/lib/auth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = googleConfig();
  const origin = config?.origin ?? url.origin;
  function redirect(path: string) {
    const response = NextResponse.redirect(new URL(path, origin));
    response.cookies.set(GOOGLE_FLOW_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google', maxAge: 0 });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  }
  if (!config || url.origin !== origin) return redirect('/login?google=unavailable');
  const flow = decodeGoogleFlow((await cookies()).get(GOOGLE_FLOW_COOKIE)?.value, url.searchParams.get('state'), origin);
  if (!flow) return redirect('/login?google=invalid_flow');
  if (url.searchParams.has('error')) return redirect('/login?google=cancelled');
  const code = url.searchParams.get('code');
  if (!code || code.length > 4096) return redirect('/login?google=invalid_flow');
  try {
    const identity = await verifyGoogleCode(code, flow);
    const user = await resolveGoogleAccount(identity, flow.termsAccepted);
    const response = redirect('/auth/google/complete');
    response.cookies.set(COOKIE_NAME, await signSession(user.id, user.sessionVersion), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_SECONDS });
    // A farm cookie from a different signed-in account must not carry over.
    response.cookies.set('reinwell_farm', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof GoogleAccountError) return redirect(`${error.code === 'terms_required' ? '/signup' : '/login'}?google=${error.code}`);
    // Provider errors can contain credentials; never log the error object.
    return redirect('/login?google=failed');
  }
}
