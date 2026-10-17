'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';

export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(!reset);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!reset) return;
    function readToken() {
      const hash = window.location.hash;
      if (hash) {
        const value = new URLSearchParams(hash.slice(1)).get('token') ?? '';
        setToken(/^[a-f0-9]{64}$/.test(value) ? value : '');
        setSuccess(false); setError('');
        // Keep the secret out of subsequent URL copies and browser history.
        window.history.replaceState(null, '', window.location.pathname);
      }
      setReady(true);
    }
    readToken();
    window.addEventListener('hashchange', readToken);
    return () => window.removeEventListener('hashchange', readToken);
  }, [reset]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    if (reset && data.get('password') !== data.get('confirmation')) { setError('Passwords do not match.'); return; }
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/auth/${reset ? 'reset-password' : 'forgot-password'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reset ? { token, password: data.get('password') } : { email: data.get('email') }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error ?? 'We could not complete this request. Please try again.'); return; }
      setSuccess(true); setToken('');
    } catch { setError('We could not connect. Please try again.'); }
    finally { setPending(false); }
  }
  const invalidLink = reset && ready && !token && !success;
  return <main className="login-page"><div className="login-mark">R</div><section className="login-card">
    <div className="login-heading"><h1>Reinwell</h1><h2>{reset ? 'Choose a new password' : 'Forgot your password?'}</h2><p>{reset ? 'Use at least 8 characters for your new password.' : 'Enter your account email and we’ll send a reset link.'}</p></div>
    {success ? <p role="status" className="form-success">{reset ? 'Your password has been changed. Sign in with your new password. You have been signed out on all devices.' : 'If an eligible account exists for that email, a reset link will arrive shortly. Check your spam folder too. The link expires in 30 minutes.'}</p> : invalidLink ? <p role="alert" className="form-error">This reset link is missing or invalid. Request a new link below.</p> : <form onSubmit={submit} className="login-form">
      <fieldset disabled={pending || !ready} className="contents">
        {reset ? <><label>New password<input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label><label>Confirm new password<input name="confirmation" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label></> : <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="button-primary login-submit" disabled={pending || !ready}>{pending ? 'Please wait…' : reset ? 'Save new password' : 'Send reset link'}</button>
      </fieldset>
    </form>}
    {reset && !success && <p className="login-footer"><Link href="/forgot-password" className="underline">Request a new reset link</Link></p>}
    <p className="login-footer"><Link href="/login" className="underline underline-offset-4">Back to sign in</Link></p>
  </section></main>;
}
