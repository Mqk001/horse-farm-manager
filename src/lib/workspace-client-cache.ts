'use client';

import { MemoryCache } from './memory-cache';
export type WorkspaceSnapshot = { user: { name: string | null; email: string }; farm: { id: string; name: string; role: string } | null; farms: { id: string; name: string; role: string }[] };
const cache = new MemoryCache<WorkspaceSnapshot>(1);
const listeners = new Set<() => void>();
const CHANNEL = 'reinwell-workspace-invalidated';
let initialized = false;
let channel: BroadcastChannel | undefined;
let generation = 0;
function clearLocal() { generation++; cache.clear(); for (const listener of listeners) listener(); }
function initialize() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = clearLocal;
  }
  window.addEventListener('storage', event => { if (event.key === CHANNEL) clearLocal(); });
  window.addEventListener('focus', clearLocal);
}
export function invalidateWorkspaceSnapshot() {
  initialize(); clearLocal();
  if (channel) channel.postMessage('invalidate');
  else if (typeof window !== 'undefined') {
    try { localStorage.setItem(CHANNEL, String(Date.now()) + Math.random()); } catch { /* In-memory cache still expires after ten seconds. */ }
  }
}
export function subscribeWorkspaceSnapshot(listener: () => void) {
  initialize(); listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export async function readWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  initialize();
  for (let attempt = 0; attempt < 2; attempt++) {
    const version = generation;
    const result = await cache.read('/api/me', async () => {
      const response = await fetch('/api/me', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Could not load your workspace.');
      return response.json() as Promise<WorkspaceSnapshot>;
    }, 10000);
    if (version === generation) return result;
  }
  throw new Error('Workspace changed. Please try again.');
}
