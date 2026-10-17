'use client';
export type DismissalUndo = { scope: string; id: string; kind: 'farm' | 'care'; title: string };
export function dismissalUndoKey(scope: string) { return `reinwell-dismissal-undo:${scope}`; }
export function rememberDismissalUndo(record: DismissalUndo) {
  try { sessionStorage.setItem(dismissalUndoKey(record.scope), JSON.stringify({ ...record, expiresAt: Date.now() + 30000 })); } catch { /* Dismissal still preserves the history record. */ }
}
