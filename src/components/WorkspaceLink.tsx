'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';

// Fully warm dynamic workspace routes on intent, without fetching every farm
// screen as soon as the sidebar mounts. Partial auto-prefetch only fetches
// the shell for these dynamic pages, adding requests without warming their data.
export function WorkspaceLink(props: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return <Link {...props} prefetch={intent ? true : false}
    onMouseEnter={event => { setIntent(true); props.onMouseEnter?.(event); }}
    onFocus={event => { setIntent(true); props.onFocus?.(event); }}
    onTouchStart={event => { setIntent(true); props.onTouchStart?.(event); }} />;
}
