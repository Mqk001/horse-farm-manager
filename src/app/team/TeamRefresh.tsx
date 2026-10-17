'use client';
import { useEffect } from 'react';

export function TeamRefresh({ revision }: { revision: string }) {
  useEffect(() => {
    let stopped = false;
    let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState !== 'visible' || document.querySelector('input:focus, select:focus, textarea:focus, [aria-label^="Confirm access change"]')) return;
      pending = true;
      try {
        const response = await fetch('/api/team/revision', { cache: 'no-store' });
        if (response.status === 401 || response.status === 403) { if (!stopped) window.location.reload(); return; }
        if (!response.ok) return;
        const body = await response.json();
        if (!stopped && body.revision !== revision) window.location.reload();
      } catch { /* Leave the current page usable during a temporary connection failure. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { stopped = true; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [revision]);
  return null;
}
