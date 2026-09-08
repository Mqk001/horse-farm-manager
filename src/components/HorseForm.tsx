'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export type HorseFields = { id: string; name: string; breed: string | null; age: number | null; colorMarkings: string | null; notes: string | null; status: string; rideIntervalDays: number; washIntervalDays: number };

export function HorseForm({ horse }: { horse?: HorseFields }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch(horse ? '/api/horses/' + horse.id : '/api/horses', {
        method: horse ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name')).trim(), breed: form.get('breed') || null,
          age: form.get('age') === '' ? null : Number(form.get('age')),
          colorMarkings: form.get('colorMarkings') || null, notes: form.get('notes') || null,
          status: form.get('status'), rideIntervalDays: Number(form.get('rideIntervalDays')),
          washIntervalDays: Number(form.get('washIntervalDays')),
        }),
      });
      if (!response.ok) throw new Error('Could not save this horse. Please try again.');
      const saved = await response.json();
      router.push('/horses/' + saved.id + '?saved=1'); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save.'); setBusy(false); }
  }
  return <main className="page-shell">
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow">The stable</p><h1 className="mt-3 font-display text-4xl">{horse ? 'Edit ' + horse.name : 'Welcome a new horse'}</h1>
      <p className="mb-8 mt-3 text-sm text-[#667169]">A profile and care rhythm tailored to your horse.</p>
      <form onSubmit={submit} className="reinwell-form premium-card rounded-3xl p-5 sm:p-8">
        <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
          <legend className="mb-5 font-display text-2xl">Profile details</legend>
          <label>Name<input name="name" required maxLength={100} pattern=".*\S.*" defaultValue={horse?.name} /></label>
          <label>Breed<input name="breed" defaultValue={horse?.breed ?? ''} placeholder="e.g. Thoroughbred" /></label>
          <label>Age in years<input name="age" type="number" min="0" max="50" defaultValue={horse?.age ?? ''} /></label>
          <label>Color & markings<input name="colorMarkings" defaultValue={horse?.colorMarkings ?? ''} /></label>
          <label className="sm:col-span-2">Status<select name="status" defaultValue={horse?.status ?? 'ACTIVE'}>{['ACTIVE', 'IN_TRAINING', 'RESTING', 'MEDICAL_HOLD', 'RETIRED'].map(status => <option key={status} value={status}>{status.replaceAll('_', ' ').toLowerCase()}</option>)}</select></label>
          <label>Ride interval (days)<input name="rideIntervalDays" type="number" min="1" required defaultValue={horse?.rideIntervalDays ?? 3} /></label>
          <label>Grooming interval (days)<input name="washIntervalDays" type="number" min="1" required defaultValue={horse?.washIntervalDays ?? 14} /></label>
          <label className="sm:col-span-2">Care notes<textarea name="notes" rows={4} defaultValue={horse?.notes ?? ''} placeholder="Temperament, special instructions, or anything worth remembering." /></label>
        </fieldset>
        {error && <p role="alert" className="form-error mt-5">{error}</p>}
        <div className="mt-7 flex flex-wrap gap-3 border-t border-[#dedbd1] pt-6"><button disabled={busy} className="button-primary">{busy ? 'Saving…' : horse ? 'Save changes' : 'Create profile'}</button><Link className="button-secondary" href={horse ? '/horses/' + horse.id : '/horses'}>Cancel</Link></div>
      </form>
    </div>
  </main>;
}
