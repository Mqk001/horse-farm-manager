import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PrismaClient as LocalClient } from '@prisma/local-client';
import type { PrismaClient } from '@prisma/client';
import { farmContextQuery, loadFarmContext } from '../src/lib/farm-context-query';

async function main() {
  assert.ok(process.env.DATABASE_URL?.startsWith('file:/private/tmp/'));
  const local = new LocalClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: [{ emit: 'event', level: 'query' }] });
  let queries = 0;
  local.$on('query', () => queries++);
  const user = await local.user.create({ data: { email: `context-${Date.now()}@example.test`, password: 'unused', name: 'Context user', emailVerifiedAt: new Date(), sessionVersion: 2 } });
  const farms = [];
  const db = local as unknown as PrismaClient;
  const session = { userId: user.id, sessionVersion: 2 };
  try {
    for (const name of ['First', 'Second', 'Foreign']) farms.push(await local.farm.create({ data: { name, code: `context-${name}-${Date.now()}` } }));
    assert.equal((await loadFarmContext(db, session))?.memberships.length, 0);
    assert.equal((await loadFarmContext(db, session))?.membership, undefined);
    const member = await local.farmMember.create({ data: { userId: user.id, farmId: farms[0].id, role: 'STAFF', careReminderEnabled: true, careReminderLeadDays: 7, careReminderHourUTC: 18 } });
    queries = 0;
    const oldUser = await local.user.findFirst({ where: { id: user.id, sessionVersion: 2 } });
    assert.ok(oldUser?.emailVerifiedAt);
    const oldMembers = await local.farmMember.findMany({ where: { userId: user.id, status: 'ACTIVE' }, include: { farm: true }, orderBy: { id: 'asc' } });
    assert.equal(queries, 3, 'Previous user/membership/farm path executes three statements');
    queries = 0;
    const one = await loadFarmContext(db, session);
    assert.equal(queries, 1);
    assert.deepEqual(one?.user, { id: user.id, name: user.name, email: user.email });
    assert.equal(one?.membership?.id, oldMembers[0].id);
    assert.equal(one?.membership?.farm.name, oldMembers[0].farm.name);
    assert.equal(one?.membership?.careReminderEnabled, true);
    assert.equal(one?.membership?.careReminderLeadDays, 7);
    assert.equal(one?.membership?.careReminderHourUTC, 18);
    await local.farmMember.create({ data: { userId: user.id, farmId: farms[1].id, role: 'MANAGER' } });
    assert.equal((await loadFarmContext(db, session))?.membership, undefined);
    assert.equal((await loadFarmContext(db, session, farms[1].id))?.membership?.role, 'MANAGER');
    assert.equal((await loadFarmContext(db, session, farms[2].id))?.membership, undefined);
    assert.equal((await loadFarmContext(db, session, "' OR 1=1 --"))?.membership, undefined);
    assert.equal(await loadFarmContext(db, { ...session, sessionVersion: 1 }, farms[0].id), null);
    assert.equal(await loadFarmContext(db, { ...session, userId: "' OR 1=1 --" }), null);
    await local.farmMember.update({ where: { id: member.id }, data: { status: 'SUSPENDED' } });
    assert.equal((await loadFarmContext(db, session, farms[0].id))?.membership, undefined);
    assert.equal((await loadFarmContext(db, session))?.membership?.farmId, farms[1].id);
    await local.user.update({ where: { id: user.id }, data: { emailVerifiedAt: null } });
    assert.equal(await loadFarmContext(db, session), null);
    console.log('PASS SQLite: one fresh query; verified session/version, membership fallback, role/reminder fields, suspended/foreign farms and injection inputs.');
  } finally {
    await local.farm.deleteMany({ where: { id: { in: farms.map(farm => farm.id) } } });
    await local.user.delete({ where: { id: user.id } });
    await local.$disconnect();
  }
  assert.ok(process.env.PGLITE_MODULE && process.env.TEST_POSTGRES_SCHEMA);
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const pg = new PGlite();
  try {
    await pg.exec(await readFile(process.env.TEST_POSTGRES_SCHEMA, 'utf8'));
    await pg.exec(`INSERT INTO "User" (id,email,password,"updatedAt","emailVerifiedAt","sessionVersion") VALUES ('actor','actor@example.test','unused',now(),now(),2); INSERT INTO "Farm" (id,name,code,"updatedAt") VALUES ('own','Own','own',now()),('other','Other','other',now()); INSERT INTO "FarmMember" (id,"farmId","userId",role,"updatedAt","careReminderEnabled") VALUES ('member','own','actor','STAFF',now(),true);`);
    const adapter = { $queryRaw: async (query: ReturnType<typeof farmContextQuery>) => (await pg.query(query.text, query.values)).rows } as unknown as PrismaClient;
    const session = { userId: 'actor', sessionVersion: 2 };
    const one = await loadFarmContext(adapter, session);
    assert.equal(one?.membership?.farm.name, 'Own');
    assert.equal(one?.membership?.careReminderEnabled, true);
    assert.equal((await loadFarmContext(adapter, session, 'other'))?.membership, undefined);
    assert.equal(await loadFarmContext(adapter, { ...session, sessionVersion: 1 }), null);
    await pg.exec(`UPDATE "FarmMember" SET status='SUSPENDED';`);
    assert.equal((await loadFarmContext(adapter, session))?.memberships.length, 0);
    await pg.exec(`UPDATE "User" SET "emailVerifiedAt"=NULL;`);
    assert.equal(await loadFarmContext(adapter, session), null);
    assert.equal(await loadFarmContext(adapter, { ...session, userId: "' OR 1=1 --" }), null);
    console.log('PASS PostgreSQL: exact parameterized query against current schema; boolean types, session/version, no-member verified user, revocation and farm scope.');
  } finally { await pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
