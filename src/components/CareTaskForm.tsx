'use client';
import { rememberDismissalUndo, dismissalUndoKey, type DismissalUndo } from '@/lib/dismissal-undo';
import { validateFormData, PayloadError } from '@/lib/request-limits';
import { completionDetails as parseCompletionDetails } from '@/lib/completion-details';
import { CompletionDetailsFields } from './CompletionDetailsFields';

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { useOptimisticTask, useOptimisticTaskPending, type OptimisticTaskChange } from './OptimisticTaskRow';

export function CareTaskForm({ action, children, className, optimistic, dismissalUndo, clearDismissalUndoScope, completionDetails = false }: { action: (data: FormData) => Promise<void>; children: ReactNode; className?: string; optimistic?: OptimisticTaskChange; dismissalUndo?: DismissalUndo; clearDismissalUndoScope?: string; completionDetails?: boolean }) {
  const router = useRouter();
  const pagePending = useOptimisticTaskPending();
  const task = useOptimisticTask();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || pagePending) return;
    const data = new FormData(event.currentTarget);
    try {
      validateFormData(data);
      if (completionDetails) {
        try { parseCompletionDetails(data); }
        catch { setError('Check the completion notes, product, and cost. Cost must be nonnegative with at most two decimal places.'); return; }
      }
      if (optimistic && task && !task.begin(optimistic)) return;
      inFlight.current = true;
      setPending(true); setError('');
      if (optimistic === 'complete') {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch('/api/tasks/complete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: completionDetails ? 'care' : 'farm', fields: Object.fromEntries(data) }),
            signal: controller.signal,
          });
          const result = await response.json().catch(() => ({ error: 'Could not confirm completion.' }));
          if (!response.ok || result.completed !== true) throw new Error(result.error || 'Completion was not confirmed.');
        } finally { clearTimeout(timeout); }
        task?.commit();
        inFlight.current = false;
        setPending(false);
        router.refresh();
        return;
      }
      await action(data);
      if (dismissalUndo) rememberDismissalUndo(dismissalUndo);
      if (clearDismissalUndoScope) { try { sessionStorage.removeItem(dismissalUndoKey(clearDismissalUndoScope)); } catch {} }
      // Retain the current filters while showing the persisted task state.
      window.location.reload();
    } catch (error) {
      task?.rollback();
      inFlight.current = false;
      setError(optimistic === 'complete' ? `${error instanceof Error && error.name !== 'AbortError' ? error.message : 'The request took too long.'} Previous view restored. Refresh to check whether it saved before retrying.` : error instanceof PayloadError ? error.message : optimistic ? 'Could not confirm this change. Previous view restored. Refresh before trying again.' : 'Could not save this task. Refresh and try again.');
      setPending(false);
    }
  }
  return <form action={action} onSubmit={submit} className={className} data-task-pending={pending ? 'true' : undefined}>
    <fieldset disabled={pending || pagePending} className="contents">{children}{completionDetails && <CompletionDetailsFields />}</fieldset>
    {pending && <p role="status" className="text-xs text-[#68736b]">Saving…</p>}
    {error && <p role="alert" className="form-error text-xs">{error}</p>}
  </form>;
}
