import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/local-client';
assert.ok(process.env.TEST_DATABASE_URL?.startsWith('file:/private/tmp/'), 'Use a disposable database');
const db = new PrismaClient({datasources:{db:{url:process.env.TEST_DATABASE_URL}}});
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3114';
async function req(path, method='GET', body, cookie='', headers={}) {
 const response=await fetch(base+path,{method,headers:{'content-type':'application/json',cookie,...headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{data=text}
 return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
try {
 const email=`audit-${Date.now()}@example.test`, password='Audit-password-123';
 let r=await req('/api/auth/signup','POST',{name:'Audit Tester',email,password,termsAccepted:true});assert.equal(r.status,201);const token=new URLSearchParams(new URL(r.data.verificationUrl).hash.slice(1)).get('token');
 const raceEmail=`race-${Date.now()}@example.test`;
 const racing=await Promise.all([req('/api/auth/signup','POST',{name:'Race test',email:raceEmail,password,termsAccepted:true}),req('/api/auth/signup','POST',{name:'Race test',email:raceEmail,password,termsAccepted:true})]);
 assert.deepEqual(racing.map(r=>r.status).sort(),[201,409]);
 const originalToken=token;
 const resend=await req('/api/auth/resend-verification','POST',{email});assert.equal(resend.status,200);const replacement=new URLSearchParams(new URL(resend.data.verificationUrl).hash.slice(1)).get('token');
 assert.equal((await req('/api/auth/verify-email','POST',{token:originalToken})).status,400);
 r=await req('/api/auth/verify-email','POST',{token:replacement});assert.equal(r.status,200);let cookie=r.cookie;
 assert.equal((await req('/api/auth/signup','POST',{name:'Audit Tester',email,password,termsAccepted:true})).status,409);
 assert.equal((await req('/api/auth/signup','POST',{name:'No Terms',email:'terms@example.test',password,termsAccepted:false})).status,400);
 assert.equal((await req('/api/farms','POST',{name:' '},cookie)).status,400);
 r=await req('/api/farms','POST',{name:'Audit Farm'},cookie);assert.equal(r.status,201);const farmId=r.data.farm.id;cookie+='; '+r.cookie;
 const valid={name:'Audit Horse',breed:'Arabian',age:0,status:'ACTIVE',rideIntervalDays:3,washIntervalDays:14,notes:'<script>audit</script>'};
 r=await req('/api/horses','POST',valid,cookie);assert.equal(r.status,200);const horseId=r.data.id;assert.equal(r.data.age,0);
 for(const invalid of [null,{}, {...valid,name:'   '},{...valid,age:-1},{...valid,age:1.5},{...valid,status:'UNKNOWN'},{...valid,rideIntervalDays:0},{...valid,washIntervalDays:-1}]) {
  assert.equal((await req('/api/horses','POST',invalid,cookie)).status,400,`Invalid horse ${JSON.stringify(invalid)}`);
 }
 assert.equal(await db.horse.count({where:{farmId}}),1);
 assert.equal((await req('/api/horses/'+horseId,'PUT',{...valid,name:'Changed Horse',status:'RESTING'},cookie)).status,200);
 assert.equal((await req('/api/horses/'+horseId,'GET',undefined,cookie)).data.name,'Changed Horse');
 assert.equal((await req('/api/horses/'+horseId,'PUT',{name:' '},cookie)).status,400);
 const ride={horseId,dateTime:'2026-10-14T12:00:00Z',riderName:'Audit Rider',rideType:'TRAIL',durationMinutes:45,notes:'Ride audit note'};
 for(const invalid of [null,{...ride,riderName:' '},{...ride,dateTime:'bad'},{...ride,dateTime:'2026-02-31T12:00:00Z'},{...ride,durationMinutes:-1},{...ride,durationMinutes:2.5},{...ride,rideType:'BAD'}]) assert.equal((await req('/api/rides','POST',invalid,cookie)).status,400);
 assert.equal((await req('/api/rides','POST',ride,cookie)).status,200);
 assert.equal((await req('/api/rides','POST',{...ride,horseId:'missing'},cookie)).status,404);
 const grooming={horseId,dateTime:'2026-10-14T13:00:00Z',type:'GROOM_ONLY',notes:'Groom audit note'};
 for(const invalid of [null,{...grooming,dateTime:'bad'},{...grooming,type:'BAD'}]) assert.equal((await req('/api/washes','POST',invalid,cookie)).status,400);
 assert.equal((await req('/api/washes','POST',grooming,cookie)).status,200);
 assert.equal(await db.rideLog.count({where:{horseId}}),1);assert.equal(await db.washLog.count({where:{horseId}}),1);
 assert.equal((await req('/api/horses','POST',valid,cookie,{origin:'https://foreign.example'})).status,403);
 const filtered=await req('/horses?q=changed&status=RESTING', 'GET',undefined,cookie);assert.ok(filtered.data.includes('Changed Horse'));
 for(const path of ['/horses?q=A&q=B','/care?horseId=A&horseId=B',`/horses/${horseId}?from=bad&from=worse`]) {
  const page=await req(path,'GET',undefined,cookie);assert.equal(page.status,200);assert.ok(page.data.includes('<h1'),path);assert.ok(!page.data.includes('Application error'),path);
 }
 const timeline=await req(`/horses/${horseId}?month=2026-10`,'GET',undefined,cookie);assert.ok(timeline.data.includes('Audit Rider'));assert.ok(timeline.data.includes('Groom audit note'));assert.ok(!timeline.data.includes('<script>audit</script>'));
 assert.equal((await req('/api/horses/'+horseId,'DELETE',undefined,cookie)).status,200);
 assert.equal(await db.rideLog.count({where:{horseId}}),0);assert.equal(await db.washLog.count({where:{horseId}}),0);assert.equal((await req('/api/horses/'+horseId,'GET',undefined,cookie)).status,404);
 console.log('PASS: resend rotation, signup terms/duplicate handling, farm creation, horse CRUD, strict validation, rides/grooming persistence, filtering, query robustness, escaping, CSRF, delete cascades');
} finally {await db.$disconnect();}
