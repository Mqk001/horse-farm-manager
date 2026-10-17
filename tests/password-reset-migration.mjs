import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated;');
  for (const migration of ['20260927000000_postgresql_baseline', '20261016170000_google_identity', '20261016200000_password_reset']) {
    await db.exec(await readFile(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'));
  }
  assert.equal((await db.query(`SELECT to_regclass('public."CareCompletion"') AS table_name`)).rows[0].table_name, null);
  await db.exec(`INSERT INTO "User" (id,email,password,"updatedAt") VALUES ('reset-user','reset@example.test','fixture',now());
    INSERT INTO "PasswordResetToken" (id,"userId","tokenHash","sessionVersion","expiresAt") VALUES ('reset-token','reset-user','hashed-token',0,now()+interval '30 minutes');`);
  assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid='"PasswordResetToken"'::regclass`)).rows[0].relrowsecurity, true);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    for (const sql of ['SELECT * FROM "PasswordResetToken"', `INSERT INTO "PasswordResetToken" (id,"userId","tokenHash","sessionVersion","expiresAt") VALUES ('denied','reset-user','denied',0,now())`]) await assert.rejects(db.query(sql), error => error.code === '42501');
    await db.exec('RESET ROLE');
  }
  await assert.rejects(db.query(`INSERT INTO "PasswordResetToken" (id,"userId","tokenHash","sessionVersion","expiresAt") VALUES ('foreign','absent','foreign',0,now())`), error => error.code === '23503');
  await db.exec(`DELETE FROM "User" WHERE id='reset-user'`);
  assert.equal((await db.query('SELECT * FROM "PasswordResetToken"')).rows.length, 0);
  console.log('PASS: standalone PostgreSQL reset migration without care upgrade, default-grant revocation, RLS denial, foreign key and user-deletion cascade');
} finally { await db.close(); }
