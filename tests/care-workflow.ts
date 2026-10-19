import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/local-client';
import { completionDetails, displayCost } from '../src/lib/completion-details';
import { reminderPreferencesSchema } from '../src/lib/reminder-preferences';
async function main() {
 const form=new FormData(); form.set('completionNotes',' All done ');form.set('productUsed',' Product A ');form.set('cost','12.34');form.set('costCurrency','CAD');
 assert.deepEqual(completionDetails(form),{completionNotes:'All done',productUsed:'Product A',costCents:1234,costCurrency:'CAD'});
 form.set('completionNotes','Line 1\r\nLine 2');assert.equal(completionDetails(form).completionNotes,'Line 1\nLine 2');
 assert.equal(displayCost(1234,'CAD'),'CAD 12.34');form.set('cost','0');assert.equal(completionDetails(form).costCents,0);
 for(const bad of ['-1','1.001','1e3','Infinity','99999999']){form.set('cost',bad);assert.throws(()=>completionDetails(form));}
 form.set('cost','');assert.equal(completionDetails(form).costCurrency,null);form.set('completionNotes','x'.repeat(2001));assert.throws(()=>completionDetails(form));
 for(const data of [{leadDays:null,hourUTC:null},{leadDays:2,hourUTC:13},{leadDays:3,hourUTC:9}])assert.equal(reminderPreferencesSchema.safeParse(data).success,false);
 assert.deepEqual(reminderPreferencesSchema.parse({leadDays:'7',hourUTC:'18'}),{leadDays:7,hourUTC:18});
 assert.ok(process.env.DATABASE_URL?.startsWith('file:/private/tmp/'));
 const db=new PrismaClient({datasources:{db:{url:process.env.DATABASE_URL}}});(globalThis as unknown as {prisma:unknown}).prisma=db;
 const {careExport,careCsv}=await import('../src/lib/care-export');
 const {runCareReminders}=await import('../src/lib/care-reminders');
 const farms:string[]=[],users:string[]=[];const originalFetch=globalThis.fetch;
 try {
  const farm=await db.farm.create({data:{name:'=HYPERLINK("bad")',code:`workflow-${Date.now()}`}});farms.push(farm.id);
  const other=await db.farm.create({data:{name:'Other',code:`workflow-other-${Date.now()}`}});farms.push(other.id);
  const horse=await db.horse.create({data:{farmId:farm.id,name:'Thunder, "Stable"'}});
  await db.careCompletion.create({data:{horseId:horse.id,itemName:'=1+1',itemType:'OTHER',completedAt:new Date('2026-10-19T12:00:00Z'),completionNotes:'line 1\nline 2',productUsed:'@SUM(1,2)',costCents:1234,costCurrency:'CAD',notes:'Existing instructions',completedByName:'Staff'}});
  const data=await careExport(horse.id,farm.id,'2026-10-19','2026-10-19');assert.ok(data);assert.equal(data.records.length,1);const csv=careCsv(data);
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"Thunder, ""Stable"""'));assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"\'@SUM(1,2)"'));assert.ok(csv.includes('"12.34","CAD"'));assert.ok(csv.includes('line 1\nline 2'));
  assert.equal(await careExport(horse.id,other.id),null);assert.equal((await careExport(horse.id,farm.id,'2026-10-20'))!.records.length,0);await assert.rejects(careExport(horse.id,farm.id,'2026-02-30'),/valid dates/);
  await db.$transaction(Array.from({length:1000},()=>db.careCompletion.create({data:{horseId:horse.id,itemName:'Bulk fixture',itemType:'OTHER',completedAt:new Date('2000-01-01T12:00:00Z')}})));
  await assert.rejects(careExport(horse.id,farm.id),/exceeds 1,000/);
  process.env.AUTH_SECRET='reinwell-workflow-test-disposable-secret';process.env.CRON_SECRET='reinwell-workflow-cron-disposable-secret';process.env.RESEND_API_KEY='mock-only';process.env.EMAIL_FROM='Reinwell <care@example.test>';process.env.APP_URL='https://reinwell.example.test';process.env.CARE_REMINDERS_ENABLED='true';
  async function recipient(label:string,hour:number,lead:number){const user=await db.user.create({data:{email:`${label}-${Date.now()}@example.test`,password:'not-used',emailVerifiedAt:new Date()}});users.push(user.id);await db.farmMember.create({data:{userId:user.id,farmId:farm.id,role:'MANAGER',careReminderEnabled:true,careReminderHourUTC:hour,careReminderLeadDays:lead}});return user.email;}
  const early=await recipient('early',8,0),late=await recipient('late',18,7);const morning=new Date();morning.setUTCHours(8,0,0,0);const evening=new Date(morning);evening.setUTCHours(18);const future=new Date(morning);future.setUTCDate(future.getUTCDate()+3);
  await db.farmTask.create({data:{farmId:farm.id,title:'Due today',dueDate:morning}});await db.farmTask.create({data:{farmId:farm.id,title:'Future work',dueDate:future}});
  const sent:{to:string[];text:string}[]=[];globalThis.fetch=async(_url,init)=>{sent.push(JSON.parse(String(init?.body)));return new Response('{}',{status:200});};
  assert.equal((await runCareReminders(morning)).sent,1);assert.equal(sent[0].to[0],early);assert.ok(!sent[0].text.includes('Future work'));
  assert.equal((await runCareReminders(evening)).sent,1);assert.equal(sent[1].to[0],late);assert.ok(sent[1].text.includes('Future work'));assert.equal((await runCareReminders(evening)).sent,0);
  console.log('PASS: exact money parsing, details validation, reminder settings validation, scoped/date-filtered history, escaped CSV/formula protection, preferred send windows/lookahead and once-daily delivery.');
 }finally{globalThis.fetch=originalFetch;await db.farm.deleteMany({where:{id:{in:farms}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
