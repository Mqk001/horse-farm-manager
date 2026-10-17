'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActivityDialog } from './ActivityDialog';

export function DashboardActivity({ horses }: { horses: { id: string; name: string }[] }) {
  const [horseId, setHorseId] = useState(horses[0]?.id ?? '');
  const [kind, setKind] = useState<'ride' | 'groom' | null>(null);
  const [saved, setSaved] = useState('');
  const router = useRouter();
  const horse = horses.find(item => item.id === horseId);
  return <section aria-label="Quick activity" className="premium-card mb-6 rounded-2xl p-5">
    <h2 className="font-display text-2xl">Log activity</h2>
    {horses.length ? <div className="reinwell-form mt-4 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1">Horse<select value={horseId} onChange={event => setHorseId(event.target.value)}>{horses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <button className="button-primary" disabled={!horse} onClick={() => { setSaved(''); setKind('ride'); }}>Log ride</button>
      <button className="button-secondary" disabled={!horse} onClick={() => { setSaved(''); setKind('groom'); }}>Log grooming</button>
    </div> : <p className="mt-3 text-sm text-[#657067]">Add an active horse to start logging activity.</p>}
    {saved && <p role="status" className="form-success mt-3">{saved}</p>}
    {kind && horse && <ActivityDialog kind={kind} horseId={horse.id} horseName={horse.name} onClose={() => setKind(null)} onSuccess={() => { setSaved(`${kind === 'ride' ? 'Ride' : 'Grooming'} saved for ${horse.name}.`); setKind(null); router.refresh(); }} />}
  </section>;
}
