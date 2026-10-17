type Entry<T> = { promise: Promise<T>; expiresAt: number; pending: boolean };

// Bounded, per-process read-through cache. Failed loads never become entries.
export class MemoryCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  constructor(private readonly capacity: number, private readonly now = () => Date.now()) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Invalid cache capacity');
  }
  delete(key: string) { this.entries.delete(key); }
  clear() { this.entries.clear(); }
  async read(key: string, load: () => Promise<T>, ttl: number | ((value: T) => number)): Promise<T> {
    let entry: Entry<T> | undefined;
    try { entry = this.entries.get(key); } catch { return load(); }
    if (entry && (entry.pending || entry.expiresAt > this.now())) return entry.promise;
    const created: Entry<T> = { promise: Promise.resolve().then(load), expiresAt: 0, pending: true };
    try {
      this.entries.delete(key);
      while (this.entries.size >= this.capacity) this.entries.delete(this.entries.keys().next().value!);
      this.entries.set(key, created);
    } catch { /* A cache storage failure must not fail a successful source read. */ }
    try {
      const value = await created.promise;
      let lifetime = 0;
      try { lifetime = typeof ttl === 'function' ? ttl(value) : ttl; } catch { /* Invalid cache metadata means no caching, not a failed source read. */ }
      created.pending = false;
      created.expiresAt = this.now() + (Number.isFinite(lifetime) ? Math.max(0, lifetime) : 0);
      return value;
    } catch (error) {
      try { if (this.entries.get(key) === created) this.entries.delete(key); } catch { /* Source error remains authoritative. */ }
      throw error;
    }
  }
}
