import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/local-client';
import bcrypt from 'bcryptjs';
assert.ok(process.env.TEST_DATABASE_URL?.startsWith('file:/private/tmp/'),'Use a disposable database');
const db=new PrismaClient({datasources:{db:{url:process.env.TEST_DATABASE_URL}}});
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3115';
try {
 const suffix=Date.now(),password='Timeline-audit-123';
 const user=await db.user.create({data:{email:`timeline-${suffix}@example.test`,name:'Timeline audit',password:await bcrypt.hash(password,10),emailVerifiedAt:new Date()}});
 const farm=await db.farm.create({data:{name:'Timeline farm',code:`timeline-${suffix}`,memberships:{create:{userId:user.id,role:'MANAGER'}}}});
 const horse=await db.horse.create({data:{farmId:farm.id,name:'Timeline audit horse'}});
 for(let i=0;i<31;i++)await db.rideLog.create({data:{horseId:horse.id,riderName:`Timeline Rider ${i}`,dateTime:new Date(`2026-10-${String(1+i%10).padStart(2,'0')}T12:00:00Z`),durationMinutes:i<2?null:20}});
 await db.washLog.create({data:{horseId:horse.id,dateTime:new Date('2026-10-05T23:59:59Z'),notes:'Boundary grooming'}});
 await db.careCompletion.create({data:{horseId:horse.id,itemName:'History snapshot',itemType:'OTHER',completedAt:new Date('2026-10-06T00:00:00Z'),completedByName:'Audit'}});
 await db.vetItem.create({data:{horseId:horse.id,itemName:'Legacy snapshot',itemType:'OTHER',lastDoneDate:new Date('2026-10-07')}});
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:user.email,password})});assert.equal(login.status,200);await login.text();
 const cookie=login.headers.get('set-cookie').split(';')[0]+`; reinwell_farm=${farm.id}`;
 async function page(query=''){const r=await fetch(base+`/horses/${horse.id}${query}`,{headers:{cookie}});assert.equal(r.status,200);return (await r.text()).replace(/<!--.*?-->/g,'');}
 const first=await page('?month=2026-10'),second=await page('?month=2026-10&page=2');
 assert.ok(first.includes('31 rides · 580 recorded minutes'));assert.ok(first.includes('2 rides without a duration'));assert.ok(first.includes('Older activity'));assert.ok(second.includes('Newer activity'));
 const list=html=>html.match(/<ol\b[^>]*>([\s\S]*?)<\/ol>/)?.[1]??'';
 const names=(list(first)+list(second)).match(/Timeline Rider \d+/g);assert.equal(names.length,31);assert.equal(new Set(names).size,31);
 let html=await page('?kind=grooming&from=2026-10-05&to=2026-10-05');assert.ok(list(html).includes('Boundary grooming'));assert.ok(!list(html).includes('Timeline Rider'));
 html=await page('?kind=care');assert.ok(list(html).includes('History snapshot'));assert.ok(list(html).includes('Legacy snapshot'));assert.ok(!list(html).includes('Boundary grooming'));
 html=await page('?month=2026-11&kind=care');assert.ok(html.includes('0 rides · 0 recorded minutes'));assert.ok(list(html).includes('History snapshot'));
 for(const query of ['?from=2026-02-31','?from=2026-99-99','?from=2026-10-10&to=2026-10-01'])assert.ok((await page(query)).includes('Enter valid dates'));
 assert.ok((await page('?from=2020-01-01&to=2020-01-02')).includes('No activity in this range'));
 const otherFarm=await db.farm.create({data:{name:'Foreign directory farm',code:`foreign-${suffix}`}});
 await db.horse.create({data:{farmId:otherFarm.id,name:'Foreign Directory Horse'}});
 await db.horse.create({data:{farmId:farm.id,name:'Another audit horse',breed:'Morgan',status:'RESTING'}});
 async function directory(query='') {const r=await fetch(base+'/horses'+query,{headers:{cookie}});assert.equal(r.status,200);return r.text();}
 let dir=await directory('?q=MORGAN&status=RESTING');assert.ok(dir.includes('Another audit horse'));assert.ok(!dir.includes('Timeline audit horse'));
 dir=await directory('?sort=name-desc');assert.ok(dir.indexOf('>Timeline audit horse</h2>')<dir.indexOf('>Another audit horse</h2>'));
 dir=await directory('?sort=recent');assert.ok(dir.indexOf('>Timeline audit horse</h2>')<dir.indexOf('>Another audit horse</h2>'));
 dir=await directory('?trainer=obsolete');assert.ok(dir.includes('Timeline audit horse'));assert.ok(dir.includes('Another audit horse'));assert.ok(!dir.includes('name="trainer"'));
 console.log('PASS: complete timeline pagination without duplicates, monthly aggregates, UTC inclusive dates, type filters, legacy/new history, invalid and empty ranges; directory breed/status filters, sorting and removed trainer control');
}finally{await db.$disconnect();}
