'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function Loading() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [recoveryUrl, setRecoveryUrl] = useState('');
  useEffect(() => {
    setVisible(false); setRecoveryUrl('');
    const show = window.setTimeout(() => setVisible(true), 250);
    const recover = window.setTimeout(() => setRecoveryUrl(window.location.href), 8000);
    return () => { window.clearTimeout(show); window.clearTimeout(recover); };
  }, [pathname]);
  return <main className="page-shell" aria-busy="true">
    <span role="status" className="sr-only">Loading page</span>
    <div aria-hidden="true" className={`min-h-[24rem] space-y-5 motion-safe:animate-pulse ${visible ? 'visible' : 'invisible'}`}><div className="h-8 w-48 rounded-xl bg-[#e5e7df]" /><div className="h-4 w-64 max-w-full rounded-lg bg-[#e5e7df]" /><div className="grid gap-5 sm:grid-cols-2"><div className="h-52 rounded-3xl bg-white/60" /><div className="h-52 rounded-3xl bg-white/60" /></div></div>
    {recoveryUrl && <p className="mt-5 text-sm text-[#657067]">Taking longer than usual. <a href={recoveryUrl} className="font-semibold underline">Reload this page</a></p>}
  </main>;
}
