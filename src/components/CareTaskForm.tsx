'use client';

import { useState, type FormEvent, type ReactNode } from 'react';

export function CareTaskForm({ action, children, className }: { action: (data: FormData) => Promise<void>; children: ReactNode; className?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true); setError('');
    try {
      await action(data);
      // Retain the current filters while showing the persisted task state.
      window.location.reload();
    } catch {
      setError('Could not save this task. Refresh and try again.');
      setPending(false);
    }
  }
  return <form action={action} onSubmit={submit} className={className}>
    <fieldset disabled={pending} className="contents">{children}</fieldset>
    {pending && <p role="status" className="text-xs text-[#68736b]">Saving…</p>}
    {error && <p role="alert" className="form-error text-xs">{error}</p>}
  </form>;
}
