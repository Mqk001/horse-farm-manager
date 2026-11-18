import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PrismaClient as LocalClient } from '@prisma/local-client';
import type { PrismaClient } from '@prisma/client';
import { loadTeamRevision, teamRevisionQuery } from '../src/lib/team-revision-query';
async function old(db: LocalClient, farmId: string) {
  const state = await Promise.all([
    db.farmTask.aggregate({ where: { farmId }, _count: true, _max: { updatedAt: true } }),
    db.vetItem.aggregate({ where: { horse: { farmId } }, _count: true, _max: { updatedAt: true } }),
    db.careCompletion.aggregate({ where: { horse: { farmId } }, _count: true, _max: { completedAt: true, dismissedAt: true } }),
    db.farmMember.aggregate({ where: { farmId }, _count: true, _max: { updatedAt: true } }),
  ]);
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}
async function main() {
  assert.ok(process.env.DATABASE_URL?.startsWith('file:/private/tmp/'));
  const db = new LocalClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const client = db as unknown as PrismaClient;
  const farm = await db.farm.create({ data: { name: 'Revision query', code: `revision-query-${Date.now()}` } });
  try {
    assert.equal(await loadTeamRevision(client, farm.id), await old(db, farm.id));
    const empty = await loadTeamRevision(client, farm.id);
    const horse = await db.horse.create({ data: { name: 'Revision horse', farmId: farm.id } });
    await db.farmTask.create({ data: { farmId: farm.id, title: 'Revision task' } });
    const care = await db.vetItem.create({ data: { horseId: horse.id, itemType: 'OTHER', itemName: 'Revision care', nextDueDate: new Date() } });
    const completion = await db.careCompletion.create({ data: { horseId: horse.id, itemType: 'OTHER', itemName: 'Revision completed', completedAt: new Date('2026-11-15T08:00:00Z') } });
    const current = await loadTeamRevision(client, farm.id);
    assert.notEqual(current, empty);
    assert.equal(current, await old(db, farm.id));
    await db.careCompletion.update({ where: { id: completion.id }, data: { dismissedAt: new Date('2026-11-16T09:00:00Z') } });
    assert.equal(await loadTeamRevision(client, farm.id), await old(db, farm.id));
    assert.notEqual(await loadTeamRevision(client, farm.id), current);
    await db.vetItem.delete({ where: { id: care.id } });
    assert.equal(await loadTeamRevision(client, farm.id), await old(db, farm.id));
    assert.equal(await loadTeamRevision(client, "' OR 1=1 --"), empty);
    console.log('PASS SQLite: identical old/new fingerprints for empty/populated farms, completion/dismissal/deletion, timestamps and injection-shaped farm IDs.');
  } finally { await db.farm.delete({ where: { id: farm.id } }); await db.$disconnect(); }
  assert.ok(process.env.PGLITE_MODULE && process.env.TEST_POSTGRES_SCHEMA);
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const pg = new PGlite();
  try {
    await pg.exec(await readFile(process.env.TEST_POSTGRES_SCHEMA, 'utf8'));
    await pg.exec(`INSERT INTO "Farm" (id,name,code,"updatedAt") VALUES ('own','Own','own',now()),('other','Other','other',now()); INSERT INTO "Horse" (id,name,"farmId","updatedAt") VALUES ('horse','Horse','own',now()); INSERT INTO "FarmTask" (id,"farmId",title,"updatedAt") VALUES ('task','own','Task','2026-11-16 08:00:00'),('hidden','other','Hidden',now()); INSERT INTO "CareCompletion" (id,"horseId","itemName","itemType","completedAt","dismissedAt") VALUES ('done','horse','Done','OTHER','2026-11-15 08:00:00','2026-11-16 09:00:00');`);
    const adapter = { $queryRaw: async (query: ReturnType<typeof teamRevisionQuery>) => (await pg.query(query.text, query.values, { parsers: { 1114: (value: string) => value } })).rows } as unknown as PrismaClient;
    const expected = [
      { _count: 1, _max: { updatedAt: '2026-11-16T08:00:00.000Z' } },
      { _count: 0, _max: { updatedAt: null } },
      { _count: 1, _max: { completedAt: '2026-11-15T08:00:00.000Z', dismissedAt: '2026-11-16T09:00:00.000Z' } },
      { _count: 0, _max: { updatedAt: null } },
    ];
    assert.equal(await loadTeamRevision(adapter, 'own'), createHash('sha256').update(JSON.stringify(expected)).digest('hex'));
    assert.notEqual(await loadTeamRevision(adapter, 'other'), await loadTeamRevision(adapter, 'own'));
    console.log('PASS PostgreSQL: exact query, aggregate integer/null types, UTC timestamps and farm scoping.');
  } finally { await pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
