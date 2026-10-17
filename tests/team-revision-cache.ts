import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/local-client';
async function main() {
  assert.ok(process.env.DATABASE_URL?.startsWith('file:/private/tmp/'));
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: [{ emit: 'event', level: 'query' }] });
  (globalThis as unknown as { prisma: unknown }).prisma = db;
  const { teamRevision, invalidateTeamRevision } = await import('../src/lib/team-revision');
  const first = await db.farm.create({ data: { name: 'Revision cache fixture', code: `revision-cache-${Date.now()}` } });
  const second = await db.farm.create({ data: { name: 'Second cache fixture', code: `revision-cache-other-${Date.now()}` } });
  let queries = 0;
  db.$on('query', event => { if (event.query.startsWith('SELECT')) queries++; });
  const originalNow = Date.now;
  try {
    let started = performance.now();
    for (let i = 0; i < 30; i++) { invalidateTeamRevision(first.id); await teamRevision(first.id); }
    const uncachedMs = performance.now() - started;
    assert.equal(queries, 120);
    queries = 0; invalidateTeamRevision(first.id); started = performance.now();
    const revisions = await Promise.all(Array.from({ length: 30 }, () => teamRevision(first.id)));
    const cachedMs = performance.now() - started;
    assert.equal(queries, 4, 'Concurrent cold readers coalesce to four aggregate SELECTs total');
    assert.ok(revisions.every((value: string) => value === revisions[0]));
    for (let i = 0; i < 30; i++) await teamRevision(first.id);
    assert.equal(queries, 4, 'Warm reads perform no aggregate SELECTs');
    await teamRevision(second.id); assert.equal(queries, 8, 'Each farm has its own cache key');
    await db.farmTask.create({ data: { farmId: first.id, title: 'New task' } });
    invalidateTeamRevision(first.id);
    assert.notEqual(await teamRevision(first.id), revisions[0]);
    const beforeExpiry = queries;
    Date.now = () => originalNow() + 2100;
    await teamRevision(first.id);
    assert.equal(queries, beforeExpiry + 4, 'Other instances/out-of-band changes are bounded by two-second expiry');
    console.log(`PASS: 30 uncached reads=${uncachedMs.toFixed(1)}ms/120 SELECTs; 30 concurrent cached reads=${cachedMs.toFixed(1)}ms/4 SELECTs; warm reads=0 SELECTs; farm keys, invalidation and expiry verified. SQLite fixture timings, not production benchmarks.`);
  } finally {
    Date.now = originalNow;
    await db.farm.deleteMany({ where: { id: { in: [first.id, second.id] } } });
    await db.$disconnect();
    delete (globalThis as unknown as { prisma?: unknown }).prisma;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
