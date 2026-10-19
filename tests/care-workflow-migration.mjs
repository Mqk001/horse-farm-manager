import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE??'@electric-sql/pglite');const db=new PGlite();
try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 for(const migration of ['20260927000000_postgresql_baseline','20261014000000_care_history_assignments','20261019000000_care_reminders','20261019020000_care_workflow_details'])await db.exec(await readFile(new URL(`../prisma/migrations/${migration}/migration.sql`,import.meta.url),'utf8'));
 await db.exec(`INSERT INTO "Horse" (id,name,"updatedAt") VALUES ('workflow-migration','Test',now()); INSERT INTO "CareCompletion" (id,"horseId","itemName","itemType") VALUES ('completion','workflow-migration','Test','OTHER');`);
 for(const change of [`"costCents"=1`,`"costCurrency"='USD'`,`"costCents"=-1,"costCurrency"='USD'`,`"costCents"=1,"costCurrency"='INVALID'`])await assert.rejects(db.exec(`UPDATE "CareCompletion" SET ${change} WHERE id='completion'`),error=>error.code==='23514');
 await db.exec(`UPDATE "CareCompletion" SET "costCents"=1234,"costCurrency"='CAD',"completionNotes"='Done',"productUsed"='Product A' WHERE id='completion'`);
 assert.equal((await db.query('SELECT "costCents" FROM "CareCompletion"')).rows[0].costCents,1234);
 const defaults=await db.query(`SELECT column_default FROM information_schema.columns WHERE table_name='FarmMember' AND column_name='careReminderLeadDays'`);assert.equal(defaults.rows[0].column_default,'3');
 console.log('PASS: PostgreSQL additive migrations, preserved default reminder settings, paired nonnegative money/currency constraints and completion detail storage.');
}finally{await db.close();}
