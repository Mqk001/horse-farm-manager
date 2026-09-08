'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('');
    const data = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.get('email'), password: data.get('password') }) });
    if (!response.ok) { setError((await response.json()).error); setLoading(false); return; }
    router.push('/dashboard'); router.refresh();
  }

  return <main className="login-page"><div className="login-mark">R</div><section className="login-card"><div className="login-heading"><p className="eyebrow">Reinwell</p><h1>Welcome back</h1><p>Sign in to continue to your stable workspace.</p></div><form onSubmit={submit} className="login-form"><label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" placeholder="Enter your password" /></label>{error && <p className="form-error">{error}</p>}<button className="button-primary login-submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button></form><p className="login-footer">New to Reinwell? <Link href="/signup" className="font-semibold text-[#183d2f] underline underline-offset-4">Create an account</Link></p></section></main>;
}
