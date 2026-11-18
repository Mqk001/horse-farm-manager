'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useRouter } from 'next/navigation';

export type OptimisticTaskChange = 'complete' | 'dismiss' | 'unassign';
type TaskState = { change: OptimisticTaskChange; saved?: boolean };
// Keep this coordinator above route content: an API save may finish after the
// user has navigated away. Refresh the current route and invalidate prefetched
// views only after every in-flight completion has settled.
const ReconciliationContext = createContext<(() => (saved: boolean) => void) | null>(null);
export function TaskReconciliationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const active = useRef(0);
  const dirty = useRef(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (active.current || !dirty.current) return;
    const timer = window.setTimeout(() => {
      if (active.current || !dirty.current) return;
      dirty.current = false;
      router.refresh();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [revision, router]);
  function begin() {
    active.current++;
    let settled = false;
    return (saved: boolean) => {
      if (settled) return;
      settled = true;
      active.current--;
      dirty.current ||= saved;
      setRevision(value => value + 1);
    };
  }
  return <ReconciliationContext.Provider value={begin}>{children}</ReconciliationContext.Provider>;
}
const PageContext = createContext<{ states: Record<string, TaskState>; begin: (key: string, change: OptimisticTaskChange) => boolean; rollback: (key: string) => void; commit: (key: string) => void } | null>(null);
export function OptimisticTasksProvider({ children }: { children: ReactNode }) {
  const reconcile = useContext(ReconciliationContext);
  const completions = useRef(new Map<string, (saved: boolean) => void>());
  const [states, setStates] = useState<Record<string, TaskState>>({});
  const active = useRef(new Set<string>());
  function begin(key: string, change: OptimisticTaskChange) {
    if (active.current.has(key)) return false;
    active.current.add(key);
    if (change === 'complete' && reconcile) completions.current.set(key, reconcile());
    setStates(current => ({ ...current, [key]: { change } })); return true;
  }
  function rollback(key: string) {
    active.current.delete(key);
    completions.current.get(key)?.(false); completions.current.delete(key);
    setStates(current => { const next = { ...current }; delete next[key]; return next; });
  }
  function commit(key: string) {
    active.current.delete(key);
    completions.current.get(key)?.(true); completions.current.delete(key);
    setStates(current => ({ ...current, [key]: { ...current[key], saved: true } }));
  }
  return <PageContext.Provider value={{ states, begin, rollback, commit }}>{children}</PageContext.Provider>;
}
export function useOptimisticTaskPending() { return Boolean(useContext(Context)?.pending); }

type TaskContext = { pending: boolean; begin: (change: OptimisticTaskChange) => boolean; rollback: () => void; commit: () => void };
const Context = createContext<TaskContext | null>(null);
export function useOptimisticTask() { return useContext(Context); }

export function OptimisticTaskRow({ as: Tag = 'div', taskKey, label, className, children }: { as?: 'div' | 'li' | 'article'; taskKey: string; label: string; className?: string; children: ReactNode }) {
  const page = useContext(PageContext);
  if (!page) throw new Error('Optimistic task rows require a page provider');
  const state = page.states[taskKey];
  const change = state?.change;
  return <Context.Provider value={{ pending: Boolean(state), begin: next => page.begin(taskKey, next), rollback: () => page.rollback(taskKey), commit: () => page.commit(taskKey) }}>
    <Tag hidden={state?.saved} className={`${className ?? ''}${change ? ' optimistic-task-pending' : ''}${state?.saved ? ' !hidden' : ''}`} data-optimistic-pending={change && !state?.saved ? 'true' : undefined} aria-busy={Boolean(change && !state?.saved)}>
      {children}
      {change && !state?.saved && <div className="optimistic-task-feedback col-span-full w-full rounded-xl bg-[#e4ece5] px-3 py-3 text-sm text-[#315c47]" role="status">
        <p className="font-semibold">{label} · {change === 'complete' ? 'Saving completion…' : change === 'dismiss' ? 'Dismissing…' : 'Unassigning…'}</p>
      </div>}
    </Tag>
  </Context.Provider>;
}
