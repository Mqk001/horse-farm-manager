import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
const db = new PGlite();
try {
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated;');
 await db.exec(await readFile(new URL('../prisma/migrations/20260927000000_postgresql_baseline/migration.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20260908154000_enable_reinwell_rls_server_only.sql',import.meta.url),'utf8'));
 await db.exec(`INSERT INTO "Horse" (id,name,"updatedAt") VALUES ('migration-horse','Migration fixture',now());
 INSERT INTO "VetItem" (id,"horseId","itemName","itemType","lastDoneDate","updatedAt") VALUES ('old-care','migration-horse','Old care','OTHER','2026-10-01',now());`);
 await db.exec(await readFile(new URL('../prisma/migrations/20261014000000_care_history_assignments/migration.sql',import.meta.url),'utf8'));
 let result=await db.query('SELECT * FROM "CareCompletion"'); assert.equal(result.rows.length,1);assert.equal(result.rows[0].legacy,true);assert.equal(result.rows[0].itemName,'Old care');
 result=await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid='"CareCompletion"'::regclass`);assert.equal(result.rows[0].relrowsecurity,true);
 result=await db.query(`SELECT roles FROM pg_policies WHERE tablename='CareCompletion'`);assert.deepEqual(result.rows[0].roles,['postgres']);
 for(const role of ['anon','authenticated']) {
  await db.exec(`SET ROLE ${role}`);
  for(const sql of ['SELECT * FROM "CareCompletion"',`INSERT INTO "CareCompletion" (id,"horseId","itemName","itemType") VALUES ('denied','migration-horse','Denied','OTHER')`]) await assert.rejects(db.query(sql),error=>error.code==='42501');
  await db.exec('RESET ROLE');
 }
 await assert.rejects(db.query(`INSERT INTO "CareCompletion" (id,"horseId","itemName","itemType") VALUES ('bad','missing','Bad','OTHER')`),error=>error.code==='23503');
 await db.exec(`DELETE FROM "VetItem" WHERE id='old-care'`);
 result=await db.query('SELECT "careItemId","itemName" FROM "CareCompletion"');assert.equal(result.rows[0].careItemId,null);assert.equal(result.rows[0].itemName,'Old care');
 await db.exec(`DELETE FROM "Horse" WHERE id='migration-horse'`);assert.equal((await db.query('SELECT * FROM "CareCompletion"')).rows.length,0);
 assert.equal((await db.query(`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)).rows[0].count,14);
 console.log('PASS: PostgreSQL baseline + care upgrade, legacy backfill, RLS/public-role denial, foreign keys, retained task history, horse cascade, 14 tables');
} finally {await db.close();}
