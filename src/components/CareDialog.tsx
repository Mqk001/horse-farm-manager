'use client';
import { useState, type ReactNode, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from './Dialog';
export function CareDialog({ children, action, disabled }: { children: ReactNode; action: (data: FormData) => Promise<void>; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try { await action(data); setOpen(false); setSaved(true); router.refresh(); }
    catch { setError('Care could not be saved. Check the fields and try again.'); }
    finally { setBusy(false); }
  }
  return <div>
    <button disabled={disabled} className="button-primary" onClick={() => { setSaved(false); setError(''); setOpen(true); }}>Schedule care</button>
    {disabled && <p className="mt-2 text-xs">Add a horse before scheduling care.</p>}
    {saved && <p role="status" className="form-success mt-3">Care added to the schedule.</p>}
    {open && <Dialog title="Schedule care" onClose={() => setOpen(false)} busy={busy}>
      <form onSubmit={submit} className="reinwell-form">
        <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">{children}</fieldset>
        {error && <p role="alert" className="form-error mt-5">{error}</p>}
        <div className="mt-6 flex gap-3"><button disabled={busy} className="button-primary">{busy ? 'Saving…' : 'Add to schedule'}</button><button disabled={busy} type="button" className="button-secondary" onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </Dialog>}
  </div>;
}
