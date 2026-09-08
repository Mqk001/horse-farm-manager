'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function VerifyEmailPage() {
  const params = useSearchParams(); const router = useRouter();
  const hasVerified = useRef(false);
  const [message, setMessage] = useState('Verifying your email…');
  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(params.get('token') ?? '')}`).then(async (response) => { if (!response.ok) throw new Error((await response.json()).error); setMessage('Email verified. Redirecting to your dashboard…'); setTimeout(() => { router.push('/dashboard'); router.refresh(); }, 900); }).catch((error) => setMessage(error.message));
  }, [params, router]);
  return <main className="login-page"><div className="login-mark">R</div><section className="login-card"><div className="login-heading"><p className="eyebrow">Reinwell</p><h1>Email verification</h1><p>{message}</p></div><p className="login-footer"><Link href="/login" className="font-semibold text-[#183d2f] underline underline-offset-4">Return to sign in</Link></p></section></main>;
}
