'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { dismissalUndoKey, type DismissalUndo } from '@/lib/dismissal-undo';
import { CareTaskForm } from './CareTaskForm';
export function DismissalUndoNotice({ scope, action }: { scope: string; action: (data: FormData) => Promise<void> }) {
  const [record, setRecord] = useState<(DismissalUndo & { expiresAt: number }) | null>(null);
  useEffect(() => {
    setRecord(null);
    const key = dismissalUndoKey(scope);
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      if (!saved || saved.scope !== scope || !['farm', 'care'].includes(saved.kind) || typeof saved.id !== 'string' || saved.id.length > 100 || typeof saved.title !== 'string' || saved.title.length > 300 || !Number.isSafeInteger(saved.expiresAt) || saved.expiresAt <= Date.now() || saved.expiresAt > Date.now() + 30000) { sessionStorage.removeItem(key); return; }
      setRecord(saved);
      const timer = window.setTimeout(() => { setRecord(null); sessionStorage.removeItem(key); }, saved.expiresAt - Date.now());
      return () => window.clearTimeout(timer);
    } catch { /* Optional undo notice must not break the page. */ }
  }, [scope]);
  if (!record) return null;
  return createPortal(<aside aria-label="Undo dismissal" className="fixed bottom-4 right-4 z-40 max-w-[calc(100%-2rem)] rounded-2xl border border-[#dedbd1] bg-[#fbfaf6] p-4 text-sm shadow-xl">
    <p role="status"><strong>{record.title}</strong> was dismissed. The history record is preserved.</p>
    <div className="mt-3 flex flex-wrap gap-2"><CareTaskForm action={action} clearDismissalUndoScope={scope}><input type="hidden" name="id" value={record.id} /><input type="hidden" name="kind" value={record.kind} /><button className="button-secondary">Undo dismissal</button></CareTaskForm><button type="button" className="button-secondary" onClick={() => { try { sessionStorage.removeItem(dismissalUndoKey(scope)); } catch {} setRecord(null); }}>Close notice</button></div>
  </aside>, document.body);
}
