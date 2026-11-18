'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';

// Warm only the small, authorized workspace navigation set. Unlike hover-based
// prefetch this also gives touch/keyboard users a fully prepared destination.
// Keep the existing 30-second Next prefetch lifetime and mutation invalidation.
export function WorkspacePrefetch({ scope, pathname, manager }: { scope: string; pathname: string; manager: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!scope) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType ?? '')) return;
    const routes = ['/dashboard', '/horses', '/care', ...(manager ? ['/team'] : [])].filter(route => route !== pathname);
    // Let hydration and the current screen win before starting background work.
    // Stagger requests instead of starting every farm query at once.
    const timers = routes.map((href, index) => window.setTimeout(() => {
      if (document.visibilityState === 'visible') router.prefetch(href, { kind: PrefetchKind.FULL });
    }, 600 + index * 350));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [scope, pathname, manager, router]);
  return null;
}
