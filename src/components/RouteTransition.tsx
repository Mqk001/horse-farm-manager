'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // No exit wait, overlays, scroll overrides or animation on query/filter edits.
  return <div key={pathname} className="route-enter">{children}</div>;
}
