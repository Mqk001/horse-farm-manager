'use client';
import { useEffect } from 'react';
import { afterSignInPath } from '@/lib/pending-invitation';
export default function GoogleCompletePage() {
  useEffect(() => { window.location.replace(afterSignInPath()); }, []);
  return <main className="login-page"><p role="status">Opening your farm…</p></main>;
}
