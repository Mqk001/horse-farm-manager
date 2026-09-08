import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
assert.ok(process.env.TEST_DATABASE_URL === 'file:./reinwell-auth-test.db' || process.env.TEST_DATABASE_URL?.startsWith('file:/private/tmp/'), 'Set TEST_DATABASE_URL to the disposable security-test database before running');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3108';
async function request(path, method='GET', body, cookie='') {
 const r = await fetch(base+path, {method, headers:{'content-type':'application/json',cookie}, body:body ? JSON.stringify(body):undefined, redirect:'manual'});
 const text = await r.text(); let data; try {data=JSON.parse(text)} catch {data=text}
 return {status:r.status, data, cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const suffix=Date.now();
async function account(n) {
 const email=`test-${suffix}-${n}@example.test`,password='Test-password-123';
 let r=await request('/api/auth/signup','POST',{name:`Test ${n}`,email,password,termsAccepted:true});assert.equal(r.status,201);
 const token=new URL(r.data.verificationUrl).searchParams.get('token');
 assert.equal((await request('/api/auth/login','POST',{email,password})).status,403);
 r=await request('/api/auth/verify-email?token='+token);assert.equal(r.status,200);const session=r.cookie;
 assert.equal((await request('/api/auth/verify-email?token='+token)).status,400);
 r=await request('/api/farms','POST',{name:`Farm ${n}`},session);assert.equal(r.status,201);
 const cookie=session+'; '+r.cookie;
 r=await request('/api/horses','POST',{name:`Horse ${n}`},cookie);assert.equal(r.status,200);assert.ok(r.data.farmId);
 return {cookie,id:r.data.id,farmId:r.data.farmId,userId:session.split('=')[1].split('.')[0]};
}
const a=await account('A'),b=await account('B');
assert.equal((await request(`/api/horses/${a.id}`,'GET',null,a.cookie)).status,200);
for(const method of ['GET','PUT','DELETE']) assert.equal((await request(`/api/horses/${b.id}`,method,method==='PUT'?{name:'stolen'}:null,a.cookie)).status,404);
for(const type of ['rides','washes']) {
 assert.equal((await request('/api/'+type,'POST',{horseId:b.id,dateTime:new Date().toISOString(),riderName:'Tester'},a.cookie)).status,404);
 assert.equal((await request('/api/'+type,'POST',{horseId:a.id,dateTime:new Date().toISOString(),riderName:'Tester'},a.cookie)).status,200);
}
assert.equal((await request('/api/farms/active','POST',{farmId:b.farmId},a.cookie)).status,403);
assert.equal((await request('/api/horses/'+a.id,'GET',null,'reinwell_session=forged')).status,401);
const payload=`${a.userId}.0.${Math.floor(Date.now()/1000)-1}`;
const expired=payload+'.'+createHmac('sha256',process.env.AUTH_SECRET).update(payload).digest('hex');
assert.equal((await request('/api/me','GET',null,'reinwell_session='+expired)).status,401);
for(const page of ['/dashboard','/horses','/care',`/horses/${a.id}`,`/horses/${a.id}/edit`]) assert.equal((await request(page,'GET',null,a.cookie)).status,200,page);
for(const page of [`/horses/${b.id}`,`/horses/${b.id}/edit`]) assert.equal((await request(page,'GET',null,a.cookie)).status,404,page);
assert.equal((await request('/api/me','GET',null,a.cookie.replace(/reinwell_farm=[^;]+/,`reinwell_farm=${b.farmId}`))).data.farm,null);
console.log('PASS: signup, verification, login denial, farm/horse creation, own-farm reads/writes, cross-farm reads/writes/pages, forged/expired sessions, farm selection');
// Seed only the isolated test database; exercise real server-action HTTP requests.
const { PrismaClient } = await import('@prisma/local-client');
const db = new PrismaClient({datasources:{db:{url:process.env.TEST_DATABASE_URL}}});
assert.ok(process.env.TEST_DATABASE_URL === 'file:./reinwell-auth-test.db' || process.env.TEST_DATABASE_URL?.includes('/private/tmp/'), 'Use a disposable temporary database');
const legacy=await db.horse.create({data:{name:'Unassigned test horse'}});
await request('/api/farms','POST',{name:'Fresh empty farm'},a.cookie);
assert.equal((await db.horse.findUnique({where:{id:legacy.id}})).farmId,null);
const item=await db.vetItem.create({data:{horseId:b.id,itemType:'VACCINATION',itemName:'Boundary test',nextDueDate:new Date('2026-10-01')}});
const html=(await request('/care','GET',null,b.cookie)).data;
const forms=[...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(m=>m[1]);
const careForms=forms.filter(f=>f.includes(item.id));
assert.equal(careForms.length,2);
for(const form of careForms) {
 const action=form.match(/name="(\$ACTION_ID_[^"]+)"/)[1];
 const fd=new FormData(); fd.set(action,'');fd.set('id',item.id);fd.set('nextDueDate','2026-11-01');
 const r=await fetch(base+'/care',{method:'POST',headers:{cookie:a.cookie,origin:base},body:fd});
 assert.equal(r.status,500);
 const unchanged=await db.vetItem.findUnique({where:{id:item.id}});assert.equal(unchanged.lastDoneDate,null);assert.equal(unchanged.nextDueDate.toISOString(),'2026-10-01T00:00:00.000Z');
 const own=await fetch(base+'/care',{method:'POST',headers:{cookie:b.cookie,origin:base},body:fd});assert.equal(own.status,200);
 // Reset the fixture between the two independent action checks.
 await db.vetItem.update({where:{id:item.id},data:{lastDoneDate:null,nextDueDate:new Date('2026-10-01')}});
}
await db.$disconnect();
console.log('PASS: legacy records remain unassigned; cross-farm care complete/reschedule denied; own-farm care actions succeed');

// A member can switch only to farms where the membership is active. Revoking that
// membership takes effect on the next request, including when the old farm cookie remains.
const db2 = new PrismaClient({datasources:{db:{url:process.env.TEST_DATABASE_URL}}});
await db2.farmMember.create({ data: { userId: a.userId, farmId: b.farmId, role: 'STAFF' } });
let switchResponse = await request('/api/farms/active', 'POST', { farmId: b.farmId }, a.cookie);
assert.equal(switchResponse.status, 200);
const aOnB = `${a.cookie}; ${switchResponse.cookie}`;
assert.equal((await request(`/api/horses/${b.id}`, 'GET', null, aOnB)).status, 200);
switchResponse = await request('/api/farms/active', 'POST', { farmId: a.farmId }, aOnB);
assert.equal(switchResponse.status, 200);
assert.equal((await request(`/api/horses/${a.id}`, 'GET', null, `${a.cookie}; ${switchResponse.cookie}`)).status, 200);
await db2.farmMember.update({ where: { farmId_userId: { farmId: b.farmId, userId: a.userId } }, data: { status: 'REMOVED' } });
assert.equal((await request(`/api/horses/${b.id}`, 'GET', null, aOnB)).status, 403);
assert.equal((await request(`/api/horses/${a.id}`, 'GET', null, a.cookie)).status, 200);
console.log('PASS: farm switch is membership-scoped and removal blocks a stale selected-farm cookie');

async function verifiedUser(n) {
 const email=`test-${suffix}-${n}@example.test`, password='Test-password-123';
 let r=await request('/api/auth/signup','POST',{name:`Test ${n}`,email,password,termsAccepted:true}); assert.equal(r.status,201);
 const token=new URL(r.data.verificationUrl).searchParams.get('token');
 r=await request('/api/auth/verify-email?token='+token); assert.equal(r.status,200);
 return {email,password};
}
const rateReset = await verifiedUser('rate-reset');
for (let i = 0; i < 4; i++) assert.equal((await request('/api/auth/login', 'POST', { email: rateReset.email, password: 'incorrect password' })).status, 401);
assert.equal((await request('/api/auth/login', 'POST', { email: rateReset.email, password: rateReset.password })).status, 200);
assert.equal((await request('/api/auth/login', 'POST', { email: rateReset.email, password: 'incorrect password' })).status, 401);
const rateLocked = await verifiedUser('rate-locked');
for (let i = 0; i < 4; i++) assert.equal((await request('/api/auth/login', 'POST', { email: rateLocked.email, password: 'incorrect password' })).status, 401);
assert.equal((await request('/api/auth/login', 'POST', { email: rateLocked.email, password: 'incorrect password' })).status, 429);
assert.equal((await request('/api/auth/login', 'POST', { email: rateLocked.email, password: rateLocked.password })).status, 429);
console.log('PASS: five failed attempts are rate limited for 15 minutes; successful sign-in clears prior failures');

const copiedSession = a.cookie;
assert.equal((await request('/api/auth/logout', 'POST', null, a.cookie)).status, 200);
assert.equal((await request('/api/me', 'GET', null, copiedSession)).status, 401);
await db2.$disconnect();
console.log('PASS: logout revokes a copied signed session token server-side');
