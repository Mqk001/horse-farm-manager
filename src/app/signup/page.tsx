'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); const [verificationUrl, setVerificationUrl] = useState(''); const [verificationSent, setVerificationSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('');
    const data = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: data.get('name'), email: data.get('email'), password: data.get('password'), termsAccepted: data.get('termsAccepted') === 'on' }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) { setError(result?.error ?? `Signup failed (${response.status}). Please try again.`); setLoading(false); return; }
    setVerificationUrl(result?.verificationUrl ?? ''); setVerificationSent(true); setLoading(false);
  }

  return <main className="login-page"><div className="login-mark">R</div><section className="login-card"><div className="login-heading"><p className="eyebrow">Reinwell</p><h1>{verificationSent ? 'Check your email' : 'Create your account'}</h1><p>{verificationSent ? 'Your account is ready. Verify your email before continuing.' : 'Start building your farm workspace.'}</p></div>{verificationSent ? <div className="login-form">{verificationUrl ? <><p className="form-success">For local testing, use this verification link:</p><a href={verificationUrl} className="button-primary login-submit">Verify email</a></> : <p className="form-success">We sent a verification link to your email address.</p>}</div> : <form onSubmit={submit} className="login-form"><label>Full name<input name="name" required autoComplete="name" placeholder="Your name" /></label><label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label><label>Password<input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></label><label className="terms-check"><input name="termsAccepted" type="checkbox" required /> <span>I agree to the <Link href="/terms" target="_blank" className="font-semibold text-[#183d2f] underline underline-offset-4">Terms and Conditions</Link> and <Link href="/privacy" target="_blank" className="font-semibold text-[#183d2f] underline underline-offset-4">Privacy Policy</Link>.</span></label>{error && <p className="form-error">{error}</p>}<button className="button-primary login-submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button></form>}<p className="login-footer">Already have an account? <Link href="/login" className="font-semibold text-[#183d2f] underline underline-offset-4">Sign in</Link></p></section></main>;
}
