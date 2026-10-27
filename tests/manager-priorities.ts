import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { PrismaClient as LocalClient } from '@prisma/local-client';
import type { PrismaClient } from '@prisma/client';
import { loadManagerPriorities, managerPrioritiesQuery, PRIORITY_GROUPS } from '../src/lib/manager-priorities';

async function main() {
  assert.ok(process.env.DATABASE_URL?.startsWith('file:/private/tmp/'));
  const db = new LocalClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: [{ emit: 'event', level: 'query' }] });
  const client = db as unknown as PrismaClient;
  let queries = 0;
  db.$on('query', () => queries++);
  const farms: string[] = []; let userId: string | undefined;
  const today = new Date('2026-10-27T00:00:00Z'), yesterday = new Date('2026-10-26T00:00:00Z'), tomorrow = new Date('2026-10-28T00:00:00Z');
  try {
    for (const label of ['Own', 'Foreign', 'Empty']) farms.push((await db.farm.create({ data: { name: label, code: `speed-${label}-${Date.now()}` } })).id);
    const user = await db.user.create({ data: { email: `speed-${Date.now()}@example.test`, password: 'unused' } }); userId = user.id;
    const member = await db.farmMember.create({ data: { farmId: farms[0], userId, role: 'MANAGER' } });
    for (const farmId of farms.slice(0, 2)) {
      const horse = await db.horse.create({ data: { farmId, name: farmId === farms[0] ? 'Own horse' : 'Foreign horse' } });
      for (let offset = 0; offset < 180; offset += 30) {
        const writes = [];
        for (let i = offset; i < offset + 30; i++) {
          writes.push(db.vetItem.create({ data: { horseId: horse.id, itemType: 'OTHER', itemName: `Care ${i}`, nextDueDate: i % 3 === 0 ? null : i % 3 === 1 ? yesterday : tomorrow, assignedMemberId: farmId === farms[0] && i % 4 === 0 ? member.id : null } }));
          writes.push(db.farmTask.create({ data: { farmId, title: `Farm ${i}`, dueDate: i % 2 ? tomorrow : yesterday, completedAt: i % 3 === 0 ? yesterday : null, dismissedAt: i % 6 === 0 ? today : null, assignedMemberId: farmId === farms[0] && i % 4 === 0 ? member.id : null, createdAt: new Date(yesterday.getTime() + i), completedByName: 'Fixture' } }));
          writes.push(db.careCompletion.create({ data: { horseId: horse.id, itemType: 'OTHER', itemName: `History ${i}`, completedAt: new Date(yesterday.getTime() + i), dismissedAt: i % 3 === 0 ? today : null, completionNotes: 'Done', productUsed: 'Product', costCents: i, costCurrency: 'CAD', completedByName: 'Fixture' } }));
        }
        await db.$transaction(writes);
      }
    }
    async function oldRead() {
      const groups = [
        { model: client.vetItem, where: { horse: { farmId: farms[0] }, nextDueDate: { lt: today } }, orderBy: [{ nextDueDate: 'asc' }, { id: 'asc' }] },
        { model: client.farmTask, where: { farmId: farms[0], completedAt: null, dueDate: { lt: today } }, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }] },
        { model: client.vetItem, where: { horse: { farmId: farms[0] }, nextDueDate: { not: null }, assignedMemberId: null }, orderBy: [{ nextDueDate: 'asc' }, { id: 'asc' }] },
        { model: client.farmTask, where: { farmId: farms[0], completedAt: null, assignedMemberId: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        { model: client.careCompletion, where: { horse: { farmId: farms[0] }, dismissedAt: null }, orderBy: [{ completedAt: 'desc' }, { id: 'asc' }] },
        { model: client.farmTask, where: { farmId: farms[0], completedAt: { not: null }, dismissedAt: null }, orderBy: [{ completedAt: 'desc' }, { id: 'asc' }] },
      ];
      return Promise.all(groups.map(async (group, i) => {
        // Deliberately reproduce the previous twelve ORM reads for comparison.
        const model = group.model as any;
        const [total, rows] = await Promise.all([model.count({ where: group.where }), model.findMany({ where: group.where, orderBy: group.orderBy, take: 5, ...(i % 2 === 0 ? { include: { horse: { select: { name: true } } } } : {}) })]);
        return { category: PRIORITY_GROUPS[i], total, ids: rows.map((row: { id: string }) => row.id) };
      }));
    }
    queries = 0;
    const expected = await oldRead(), oldQueries = queries;
    queries = 0;
    const actual = await loadManagerPriorities(client, farms[0], today), newQueries = queries;
    assert.equal(newQueries, 1); assert.ok(oldQueries >= 12);
    for (const group of expected) {
      assert.equal(actual.totals[group.category], group.total);
      assert.deepEqual(actual.groups[group.category].map(row => row.id), group.ids);
      for (const row of actual.groups[group.category]) { assert.ok(Number.isFinite(row.date.getTime())); assert.notEqual(row.horseName, 'Foreign horse'); }
    }
    assert.equal(typeof actual.groups.reviewCare[0].costCents, 'number'); assert.equal(actual.groups.reviewCare[0].notes, 'Done'); assert.equal(actual.groups.reviewCare[0].costCurrency, 'CAD');
    for (const farmId of [farms[2], "' OR 1=1 --"]) {
      const empty = await loadManagerPriorities(client, farmId, today);
      assert.deepEqual(Object.values(empty.totals), [0, 0, 0, 0, 0, 0]);
      assert.equal(Object.values(empty.groups).flat().length, 0);
    }
    await oldRead(); await loadManagerPriorities(client, farms[0], today);
    const oldTimes = [], newTimes = [];
    for (let i = 0; i < 8; i++) {
      let started = performance.now(); await oldRead(); oldTimes.push(performance.now() - started);
      started = performance.now(); await loadManagerPriorities(client, farms[0], today); newTimes.push(performance.now() - started);
    }
    const median = (values: number[]) => [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)].toFixed(2);
    console.log(`PASS SQLite: identical totals/top-five ordering for all six categories; farm isolation, empty farm and injection input; ${oldQueries} -> ${newQueries} database statements; local median ${median(oldTimes)}ms -> ${median(newTimes)}ms (not production latency).`);
  } finally {
    await db.farm.deleteMany({ where: { id: { in: farms } } });
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }
  assert.ok(process.env.PGLITE_MODULE && process.env.TEST_POSTGRES_SCHEMA);
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const pg = new PGlite();
  try {
    await pg.exec(await readFile(process.env.TEST_POSTGRES_SCHEMA, 'utf8'));
    await pg.exec(`INSERT INTO "Farm" (id,name,code,"updatedAt") VALUES ('own','Own','own',now()),('foreign','Foreign','foreign',now()); INSERT INTO "Horse" (id,name,"farmId","updatedAt") VALUES ('horse','Own horse','own',now()),('foreign-horse','Foreign horse','foreign',now());`);
    for (let i = 0; i < 8; i++) {
      await pg.query(`INSERT INTO "VetItem" (id,"horseId","itemName","itemType","nextDueDate","updatedAt") VALUES ($1,'horse',$1,'OTHER',$2,now())`, [`care-${i}`, yesterday]);
      await pg.query(`INSERT INTO "FarmTask" (id,"farmId",title,"dueDate","updatedAt") VALUES ($1,'own',$1,$2,now())`, [`farm-${i}`, yesterday]);
      await pg.query(`INSERT INTO "CareCompletion" (id,"horseId","itemName","itemType","completedAt","completionNotes","costCents","costCurrency") VALUES ($1,'horse',$1,'OTHER',$2,'Done',0,'CAD')`, [`history-${i}`, yesterday]);
    }
    await pg.exec(`UPDATE "CareCompletion" SET "dismissedAt"=now() WHERE id='history-0'; INSERT INTO "FarmTask" (id,"farmId",title,"completedAt","updatedAt") VALUES ('completed','own','Completed',now(),now()),('hidden','foreign','Hidden',NULL,now());`);
    await pg.query(`INSERT INTO "VetItem" (id,"horseId","itemName","itemType","nextDueDate","updatedAt") VALUES ('future','horse','Future','OTHER',$1,now()),('hidden-care','foreign-horse','Hidden care','OTHER',$2,now())`, [tomorrow, yesterday]);
    const adapter = { $queryRaw: async (query: ReturnType<typeof managerPrioritiesQuery>) => (await pg.query(query.text, query.values, { parsers: { 1114: (value: string) => value } })).rows } as unknown as PrismaClient;
    const result = await loadManagerPriorities(adapter, 'own', today);
    assert.deepEqual(result.totals, { overdueCare: 8, overdueFarm: 8, unassignedCare: 9, unassignedFarm: 8, reviewCare: 7, reviewFarm: 1 });
    assert.equal(result.groups.overdueCare.length, 5); assert.equal(result.groups.reviewCare[0].costCents, 0); assert.equal(result.groups.reviewCare[0].costCurrency, 'CAD');
    assert.deepEqual(result.groups.overdueCare.map(row => row.date.toISOString()), Array(5).fill(yesterday.toISOString()));
    const empty = await loadManagerPriorities(adapter, "' OR 1=1 --", today); assert.equal(Object.values(empty.groups).flat().length, 0);
    console.log('PASS PostgreSQL: same parameterized query executes against current schema; full counts beyond five previews; future/dismissed/foreign rows excluded correctly; exact dates and zero-cost currency preserved.');
  } finally { await pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
