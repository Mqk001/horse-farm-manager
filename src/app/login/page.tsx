'use client';

import { FormEvent, MouseEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('');
    const data = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.get('email'), password: data.get('password') }) });
    if (!response.ok) { setError((await response.json()).error); setLoading(false); return; }
    router.push('/dashboard'); router.refresh();
  }

  async function resendVerification(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const form = event.currentTarget.form;
    const email = form ? new FormData(form).get('email') : null;
    if (typeof email !== 'string' || !email) { setError('Enter your email address first.'); return; }
    setResendLoading(true); setResendMessage('');
    const response = await fetch('/api/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) setError(result?.error ?? 'We could not send the verification email.');
    else setResendMessage('If this account needs verification, we sent a new link.');
    setResendLoading(false);
  }

  return <main className="login-page"><div className="login-mark">R</div><section className="login-card"><div className="login-heading"><p className="eyebrow">Reinwell</p><h1>Welcome back</h1><p>Sign in to continue to your stable workspace.</p></div><form onSubmit={submit} className="login-form"><label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" placeholder="Enter your password" /></label>{error && <p className="form-error">{error}</p>}{resendMessage && <p className="form-success">{resendMessage}</p>}<button className="button-primary login-submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button><button type="button" onClick={resendVerification} className="login-footer underline underline-offset-4" disabled={resendLoading}>{resendLoading ? 'Sending verification email…' : 'Resend verification email'}</button></form><p className="login-footer">New to Reinwell? <Link href="/signup" className="font-semibold text-[#183d2f] underline underline-offset-4">Create an account</Link></p></section></main>;
}
