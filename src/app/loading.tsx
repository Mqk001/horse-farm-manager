'use client';

import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Loading() {
  const pathname = usePathname();
  const [recoveryUrl, setRecoveryUrl] = useState('');
  useEffect(() => {
    setRecoveryUrl('');
    const timer = window.setTimeout(() => setRecoveryUrl(window.location.href), 8000);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return <main className="page-shell" aria-busy="true">
    <div className="premium-card rounded-2xl p-6 text-[#526057]">
      <p role="status" className="flex items-center gap-3"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> Loading your workspace…</p>
      {recoveryUrl && <p className="mt-3 text-sm">Taking longer than usual. <a href={recoveryUrl} className="font-semibold text-[#183d2f] underline">Open this page directly</a></p>}
    </div>
  </main>;
}
