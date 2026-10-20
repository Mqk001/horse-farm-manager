'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';

// Fully warm dynamic workspace routes on intent, without fetching every farm
// screen as soon as the sidebar mounts.
export function WorkspaceLink(props: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return <Link {...props} prefetch={intent ? true : null}
    onMouseEnter={event => { setIntent(true); props.onMouseEnter?.(event); }}
    onFocus={event => { setIntent(true); props.onFocus?.(event); }}
    onTouchStart={event => { setIntent(true); props.onTouchStart?.(event); }} />;
}
