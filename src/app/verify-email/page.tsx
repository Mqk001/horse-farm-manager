'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

export default function VerifyEmailPage() {
  return <Suspense fallback={<main className="login-page">Loading verification…</main>}><VerificationContent /></Suspense>;
}

function VerificationContent() {
  const params = useSearchParams(); const router = useRouter();
  const token = params.get('token') ?? new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.slice(1)).get('token');
  const hasVerified = useRef(false);
  const [message, setMessage] = useState('Verifying your email…');
  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token ?? '')}`).then(async (response) => { if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error ?? 'We could not verify this email. Please request a new link.'); } setMessage('Email verified. Redirecting to your dashboard…'); setTimeout(() => { router.push('/dashboard'); router.refresh(); }, 900); }).catch((error) => setMessage(error.message));
  }, [router, token]);
  return <main className="login-page"><div className="login-mark">R</div><section className="login-card"><div className="login-heading"><p className="eyebrow">Reinwell</p><h1>Email verification</h1><p>{message}</p></div><p className="login-footer"><Link href="/login" className="font-semibold text-[#183d2f] underline underline-offset-4">Return to sign in</Link></p></section></main>;
}
