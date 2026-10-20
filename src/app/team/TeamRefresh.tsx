'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function TeamRefresh({ revision }: { revision: string }) {
  const router = useRouter();
  const [hasUpdates, setHasUpdates] = useState(false);
  useEffect(() => { setHasUpdates(false); }, [revision]);
  useEffect(() => {
    let stopped = false;
    let pending = false;
    let lastChecked = Date.now();
    const isEditing = () => Boolean(document.querySelector('[data-task-pending="true"], [data-optimistic-pending="true"], input:focus, select:focus, textarea:focus, [aria-label^="Confirm access change"]'));
    const check = async () => {
      if (hasUpdates || pending || Date.now() - lastChecked < 5000 || document.visibilityState !== 'visible' || isEditing()) return;
      lastChecked = Date.now();
      pending = true;
      try {
        const response = await fetch('/api/team/revision', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (response.status === 401 || response.status === 403) {
          if (!stopped && !isEditing()) router.replace(response.status === 401 ? '/login' : '/dashboard');
          return;
        }
        if (!response.ok) return;
        const body = await response.json();
        if (!stopped && !isEditing() && body.revision !== revision) setHasUpdates(true);
      } catch { /* Keep the current page usable while offline or on a slow connection. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(check, 15000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { stopped = true; window.clearInterval(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [revision, router, hasUpdates]);
  return hasUpdates ? <aside role="status" aria-label="Team updates" className="fixed bottom-4 right-4 z-30 max-w-[calc(100%-2rem)] rounded-2xl border border-[#d6dfd4] bg-[#fbfaf6] p-4 text-sm text-[#183d2f] shadow-lg"><p className="font-semibold">Team changes are ready.</p><p className="mt-1 text-xs">Refresh when you’re ready to see the latest work.</p><a href="/team" className="button-secondary mt-3 !px-3 !py-2 !text-xs">Show latest</a></aside> : null;
}
