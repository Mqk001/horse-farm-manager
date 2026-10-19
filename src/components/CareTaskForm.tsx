'use client';
import { rememberDismissalUndo, dismissalUndoKey, type DismissalUndo } from '@/lib/dismissal-undo';
import { validateFormData, PayloadError } from '@/lib/request-limits';
import { completionDetails as parseCompletionDetails } from '@/lib/completion-details';
import { CompletionDetailsFields } from './CompletionDetailsFields';

import { useRef, useState, type FormEvent, type ReactNode } from 'react';

import { useOptimisticTask, useOptimisticTaskPending, type OptimisticTaskChange } from './OptimisticTaskRow';

export function CareTaskForm({ action, children, className, optimistic, dismissalUndo, clearDismissalUndoScope, completionDetails = false }: { action: (data: FormData) => Promise<void>; children: ReactNode; className?: string; optimistic?: OptimisticTaskChange; dismissalUndo?: DismissalUndo; clearDismissalUndoScope?: string; completionDetails?: boolean }) {
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
      await action(data);
      if (dismissalUndo) rememberDismissalUndo(dismissalUndo);
      if (clearDismissalUndoScope) { try { sessionStorage.removeItem(dismissalUndoKey(clearDismissalUndoScope)); } catch {} }
      // Retain the current filters while showing the persisted task state.
      window.location.reload();
    } catch (error) {
      task?.rollback();
      inFlight.current = false;
      setError(error instanceof PayloadError ? error.message : optimistic ? 'Could not confirm this change. Previous view restored. Refresh before trying again.' : 'Could not save this task. Refresh and try again.');
      setPending(false);
    }
  }
  return <form action={action} onSubmit={submit} className={className} data-task-pending={pending ? 'true' : undefined}>
    <fieldset disabled={pending || pagePending} className="contents">{children}{completionDetails && <CompletionDetailsFields />}</fieldset>
    {pending && <p role="status" className="text-xs text-[#68736b]">Saving…</p>}
    {error && <p role="alert" className="form-error text-xs">{error}</p>}
  </form>;
}
