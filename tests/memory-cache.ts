import assert from 'node:assert/strict';
import { MemoryCache } from '../src/lib/memory-cache';
async function main() {
  let now = 0, calls = 0;
  const cache = new MemoryCache<number>(2, () => now);
  const load = async () => { calls++; return calls; };
  assert.deepEqual(await Promise.all(Array.from({ length: 50 }, () => cache.read('a', load, 100))), Array(50).fill(1));
  assert.equal(calls, 1);
  assert.equal(await cache.read('a', load, 100), 1);
  now = 100; assert.equal(await cache.read('a', load, 100), 2);
  cache.delete('a'); assert.equal(await cache.read('a', load, 100), 3);
  await assert.rejects(cache.read('failure', async () => { throw new Error('source'); }, 100));
  assert.equal(await cache.read('failure', async () => 4, 100), 4);
  await cache.read('b', async () => 5, 100);
  assert.equal(await cache.read('a', load, 100), 4); // Capacity evicted oldest key.
  let release!: (value: number) => void;
  const old = cache.read('race', () => new Promise<number>(resolve => { release = resolve; }), 100);
  await Promise.resolve(); cache.delete('race');
  assert.equal(await cache.read('race', async () => 8, 100), 8);
  release(7); await old;
  assert.equal(await cache.read('race', load, 100), 8); // Old result cannot repopulate.
  cache.clear();
  assert.equal(await cache.read('zero', load, 0), 5);
  assert.equal(await cache.read('zero', load, 0), 6);
  // Simulate a cache storage failure; source remains usable.
  const broken = new MemoryCache<number>(1);
  (broken as unknown as { entries: Map<string, unknown> }).entries.get = () => { throw new Error('cache unavailable'); };
  assert.equal(await broken.read('key', async () => 42, 100), 42);
  console.log('PASS: 50 concurrent reads coalesce to one source read; TTL, invalidation, capacity, source failure, stale in-flight isolation and cache-failure fallback');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
