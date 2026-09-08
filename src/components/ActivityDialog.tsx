'use client';
import { useState, type FormEvent } from 'react';
import { Dialog } from './Dialog';

export type ActivityProps = { horseId: string; horseName: string; onClose: () => void; onSuccess: () => void };
export function localDateTime() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function ActivityDialog({ horseId, horseName, onClose, onSuccess, kind }: ActivityProps & { kind: 'ride' | 'groom' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [date] = useState(localDateTime);
  const ride = kind === 'ride';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch(ride ? '/api/rides' : '/api/washes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horseId, dateTime: new Date(String(form.get('dateTime'))).toISOString(),
          riderName: form.get('riderName'), rideType: form.get('type'), type: form.get('type'),
          durationMinutes: form.get('durationMinutes') ? Number(form.get('durationMinutes')) : undefined,
          notes: form.get('notes') || undefined }),
      });
      if (!response.ok) throw new Error('Could not save this activity. Please try again.');
      onSuccess();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save.'); setBusy(false); }
  }
  return <Dialog title={ride ? 'Log a ride' : 'Log grooming'} onClose={onClose} busy={busy}>
    <p className="mb-6 text-sm text-[#667169]">Record care for {horseName}.</p>
    <form onSubmit={submit} className="reinwell-form">
      <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2">Date & time<input name="dateTime" type="datetime-local" required defaultValue={date} /></label>
        {ride && <label className="sm:col-span-2">Rider name<input name="riderName" required /></label>}
        <label>Type<select name="type">{(ride ? ['FLAT', 'TRAIL', 'JUMP', 'TRAINING', 'OTHER'] : ['FULL_WASH', 'LEGS_ONLY', 'GROOM_ONLY', 'OTHER']).map(type => <option key={type} value={type}>{type.replaceAll('_', ' ').toLowerCase()}</option>)}</select></label>
        {ride && <label>Duration (minutes)<input name="durationMinutes" type="number" min="1" /></label>}
        <label className="sm:col-span-2">Notes<textarea name="notes" rows={3} placeholder="How did it go?" /></label>
      </fieldset>
      {error && <p role="alert" className="form-error mt-5">{error}</p>}
      <div className="mt-6 flex gap-3"><button disabled={busy} className="button-primary">{busy ? 'Saving…' : 'Save activity'}</button><button type="button" disabled={busy} onClick={onClose} className="button-secondary">Cancel</button></div>
    </form>
  </Dialog>;
}
