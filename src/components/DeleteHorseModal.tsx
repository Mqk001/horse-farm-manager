'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from './Dialog';

export function DeleteHorseModal({ horseId, horseName, onClose }: { horseId: string; horseName: string; onClose: () => void }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (inFlight.current || confirmation !== horseName) return;
    inFlight.current = true; setLoading(true); setError('');
    try {
      const response = await fetch(`/api/horses/${horseId}`, { method: 'DELETE' });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error ?? 'Could not delete this horse. Please try again.'); }
      router.push('/horses'); router.refresh();
    } catch (error) {
      setError(error instanceof TypeError ? 'Connection interrupted. Refresh to check whether the horse was deleted before trying again.' : error instanceof Error ? error.message : 'Could not connect. Refresh to check whether the horse was deleted before trying again.');
      inFlight.current = false; setLoading(false);
    }
  }
  return <Dialog title={`Delete ${horseName}?`} onClose={onClose} busy={loading}>
    <p className="text-sm leading-6">Permanently delete <strong>{horseName}</strong> and all of their ride logs, grooming records, scheduled care and care history? This cannot be undone.</p>
    <label className="reinwell-form mt-5 block text-sm">Type <strong>{horseName}</strong> to confirm<input className="mt-2" value={confirmation} onChange={event => setConfirmation(event.target.value)} maxLength={100} autoComplete="off" spellCheck={false} disabled={loading} /></label>
    {error && <p role="alert" className="form-error mt-4">{error}</p>}
    <div className="mt-6 flex flex-wrap gap-3"><button type="button" className="button-danger" disabled={loading || confirmation !== horseName} onClick={remove}>{loading ? 'Deleting…' : `Delete ${horseName}`}</button><button type="button" className="button-secondary" disabled={loading} onClick={onClose}>Keep horse</button></div>
  </Dialog>;
}
