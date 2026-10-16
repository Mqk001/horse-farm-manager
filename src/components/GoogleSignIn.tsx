'use client';
import { useEffect, useState } from 'react';

const messages: Record<string, string> = {
  invalid_flow: 'This Google sign-in expired. Please try again.',
  cancelled: 'Google sign-in was cancelled. You can try again or use your password.',
  unavailable: 'Google sign-in is temporarily unavailable.',
  failed: 'We could not sign you in with Google. Please try again.',
  verify_first: 'Verify your existing Reinwell email first, then try Google sign-in.',
  use_password: 'For this Google account, please use email and password. Google sign-in currently supports Gmail and Google Workspace accounts.',
  terms_required: 'To create an account with Google, accept the terms below and choose Continue with Google.',
  account_conflict: 'This account is already linked. Please use your existing sign-in method.',
};
export function GoogleSignIn({ signup = false, termsAccepted = false }: { signup?: boolean; termsAccepted?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const reason = new URLSearchParams(window.location.search).get('google');
    if (reason && messages[reason]) setError(messages[reason]);
    fetch('/api/auth/google', { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => { if (!controller.signal.aborted) setEnabled(Boolean(data?.enabled)); }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  async function start() {
    if (busy || (signup && !termsAccepted)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/google/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ termsAccepted: signup && termsAccepted }) });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.url) throw new Error(body?.error ?? 'Google sign-in is unavailable. Please try again.');
      window.location.assign(body.url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not connect. Please try again.'); setBusy(false); }
  }
  return <>{error && <p role="alert" className="form-error mt-4">{error}</p>}{enabled && <div className="mt-6 border-t border-[#dddcd3] pt-5"><button type="button" onClick={start} disabled={busy || (signup && !termsAccepted)} className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#dadce0] bg-white px-4 py-3 text-sm font-medium text-[#3c4043] transition hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-50"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.87 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>{busy ? 'Opening Google…' : 'Continue with Google'}</button>{signup && !termsAccepted && <p className="mt-2 text-center text-xs text-[#657067]">Accept the terms above to continue with Google.</p>}</div>}</>;
}
