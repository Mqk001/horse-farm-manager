'use client';
import { invalidateWorkspaceSnapshot } from '@/lib/workspace-client-cache';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearInvitation, rememberInvitation } from '@/lib/pending-invitation';

export default function InvitePage() {
  const router = useRouter();
  const started = useRef(false);
  const [message, setMessage] = useState('Accepting your invitation…');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (!token || !/^[a-f0-9]{64}$/.test(token)) { setMessage('This invitation link is invalid.'); return; }
    rememberInvitation(token);
    fetch('/api/invitations/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).then(async response => {
      const body = await response.json().catch(() => null);
      if (response.status === 401) setNeedsSignIn(true);
      if (!response.ok) throw new Error(body?.error ?? 'We could not accept this invitation.');
      clearInvitation(); invalidateWorkspaceSnapshot();
      setMessage('Invitation accepted. Opening your farm…');
      router.replace('/dashboard'); router.refresh();
    }).catch(error => setMessage(error.message));
  }, [router]);
  return <main className="login-page"><div className="login-mark">R</div><section className="login-card"><div className="login-heading"><h1>Reinwell</h1><h2>Farm invitation</h2><p role="status">{message}</p></div><p className="login-footer"><Link href="/login" className="underline">Sign in with your invited email</Link>{needsSignIn && <> or <Link href="/signup" className="underline">create an account</Link></>}</p></section></main>;
}
