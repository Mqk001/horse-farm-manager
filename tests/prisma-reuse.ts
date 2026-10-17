import assert from 'node:assert/strict';
async function main() {
  assert.ok(process.env.DATABASE_URL?.startsWith('file:/private/tmp/'), 'Disposable database only');
  assert.equal(process.env.NODE_ENV, 'production');
  const path = require.resolve('../src/lib/prisma');
  const first = require(path).prisma;
  delete require.cache[path];
  const second = require(path).prisma;
  assert.equal(first, second, 'Production module reload must reuse the same client');
  try {
    const results = await Promise.all(Array.from({ length: 32 }, () => second.$queryRaw`SELECT 1 AS value`));
    assert.equal(results.length, 32);
    assert.ok(results.every(rows => Number(rows[0].value) === 1));
    console.log('PASS: one production Prisma client across module reloads and 32 concurrent fixture reads; no per-operation client creation');
  } finally { await first.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
