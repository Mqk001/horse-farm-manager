'use client';
import { useState } from 'react';

export function HorseAvatar({ id, name, photo, className }: { id: string; name: string; photo?: string | null; className: string }) {
  const [failed, setFailed] = useState('');
  // Only serve farm-authorized images from our own endpoint, never arbitrary URLs.
  const safe = photo?.startsWith(`/api/horses/${encodeURIComponent(id)}/photo?v=`) && /^\/api\/horses\/[^/]+\/photo\?v=[a-f0-9]{20}$/.test(photo) ? photo : null;
  return <div className={`overflow-hidden ${className}`}>
    {safe && failed !== safe ? <img src={safe} alt={`${name} photo`} width={640} height={640} loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(safe)} /> : <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>}
  </div>;
}
