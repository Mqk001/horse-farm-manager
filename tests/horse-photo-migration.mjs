import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
const db = new PGlite();
try {
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated;');
 await db.exec(await readFile(new URL('../prisma/migrations/20260927000000_postgresql_baseline/migration.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../prisma/migrations/20261019010000_horse_photos/migration.sql',import.meta.url),'utf8'));
 await db.exec(`INSERT INTO "Horse" (id,name,"updatedAt") VALUES ('photo-migration-horse','Migration horse',now()); INSERT INTO "HorsePhoto" ("horseId",data,version,"updatedAt") VALUES ('photo-migration-horse',decode('ff','hex'),'test',now());`);
 assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid='"HorsePhoto"'::regclass`)).rows[0].relrowsecurity,true);
 for (const role of ['anon','authenticated']) {
  await db.exec(`SET ROLE ${role}`);
  await assert.rejects(db.query('SELECT * FROM "HorsePhoto"'),error=>error.code==='42501');
  await db.exec('RESET ROLE');
 }
 await assert.rejects(db.query(`UPDATE "HorsePhoto" SET data=decode(repeat('ff',262145),'hex')`),error=>error.code==='23514');
 await db.exec(`DELETE FROM "Horse" WHERE id='photo-migration-horse'`);
 assert.equal((await db.query('SELECT count(*)::int AS count FROM "HorsePhoto"')).rows[0].count,0);
 console.log('PASS: actual PostgreSQL photo migration, private RLS/grants, 256KiB storage constraint and cascade cleanup.');
} finally {await db.close();}
