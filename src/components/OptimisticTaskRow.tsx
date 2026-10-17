'use client';

import { createContext, useContext, useRef, useState, type ReactNode } from 'react';

export type OptimisticTaskChange = 'complete' | 'dismiss' | 'unassign';
type PageState = { key: string; change: OptimisticTaskChange };
const PageContext = createContext<{ state: PageState | null; begin: (key: string, change: OptimisticTaskChange) => boolean; rollback: () => void } | null>(null);
export function OptimisticTasksProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PageState | null>(null);
  const active = useRef(false);
  function begin(key: string, change: OptimisticTaskChange) {
    if (active.current) return false;
    active.current = true; setState({ key, change }); return true;
  }
  function rollback() { active.current = false; setState(null); }
  return <PageContext.Provider value={{ state, begin, rollback }}>{children}</PageContext.Provider>;
}
export function useOptimisticTaskPending() { return Boolean(useContext(PageContext)?.state); }

type TaskContext = { begin: (change: OptimisticTaskChange) => boolean; rollback: () => void };
const Context = createContext<TaskContext | null>(null);
export function useOptimisticTask() { return useContext(Context); }

export function OptimisticTaskRow({ as: Tag = 'div', taskKey, label, className, children }: { as?: 'div' | 'li' | 'article'; taskKey: string; label: string; className?: string; children: ReactNode }) {
  const page = useContext(PageContext);
  if (!page) throw new Error('Optimistic task rows require a page provider');
  const change = page.state?.key === taskKey ? page.state.change : null;
  function begin(next: OptimisticTaskChange) { return page!.begin(taskKey, next); }
  function rollback() { page!.rollback(); }
  const status = change === 'complete' ? 'Completed' : change === 'dismiss' ? 'Dismissed' : 'Unassigned';
  return <Context.Provider value={{ begin, rollback }}>
    <Tag className={`${className ?? ''}${change ? ' optimistic-task-pending' : ''}`} data-optimistic-pending={change ? 'true' : undefined} aria-busy={Boolean(change)}>
      {children}
      {change && <div className="optimistic-task-feedback col-span-full w-full rounded-xl bg-[#e4ece5] px-3 py-3 text-sm text-[#315c47]" role="status">
        <p className="font-semibold">{label} · {status}</p>
        <p className="mt-1 text-xs">Saving… Waiting for confirmation.</p>
      </div>}
    </Tag>
  </Context.Provider>;
}
