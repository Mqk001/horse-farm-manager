import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/local-client';
import bcrypt from 'bcryptjs';
assert.ok(process.env.TEST_DATABASE_URL?.startsWith('file:/private/tmp/'), 'Use a disposable database');
const db=new PrismaClient({datasources:{db:{url:process.env.TEST_DATABASE_URL}}});
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:3109';
async function post(path,body,cookie='') {
 const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(body)});
 return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};
}
try {
 const email=`production-${Date.now()}@example.test`,password='Disposable-production-test';
 const before=await db.user.count();
 for(const path of ['/api/auth/signup','/api/auth/resend-verification']) {
  const r=await post(path,{name:'Production test',email,password,termsAccepted:true});
  assert.equal(r.status,503); assert.equal(r.body.verificationUrl,undefined);
 }
 assert.equal(await db.user.count(),before);
 await db.user.create({data:{email,password:await bcrypt.hash(password,12),emailVerifiedAt:new Date(),termsAcceptedAt:new Date()}});
 const login=await post('/api/auth/login',{email,password}); assert.equal(login.status,200);
 assert.match(login.cookie,/Secure/i);assert.match(login.cookie,/HttpOnly/i);assert.match(login.cookie,/SameSite=Lax/i);
 const cookie=login.cookie.split(';')[0];
 const farm=await post('/api/farms',{name:'Production fixture farm'},cookie);assert.equal(farm.status,201);
 const invitation=await post('/api/invitations',{email:'fixture@example.test',role:'STAFF'},cookie+'; '+farm.cookie.split(';')[0]);
 assert.equal(invitation.status,503);assert.equal(invitation.body.invitationUrl,undefined);
 assert.equal((await post('/api/auth/logout',{},cookie)).status,200);
 assert.equal((await fetch(base+'/api/me',{headers:{cookie}})).status,401);
 assert.equal((await fetch(base+'/api/auth/verify-email?token=unused')).status,405);
 console.log('PASS: production signup/resend/invitation fail closed without email credentials; no account inserted; secure session cookie; logout revocation; verification GET disabled');
} finally {await db.$disconnect();}
