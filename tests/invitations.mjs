import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/local-client';
assert.ok(process.env.TEST_DATABASE_URL?.startsWith('file:/private/tmp/'), 'Use a disposable database');
const db = new PrismaClient({datasources:{db:{url:process.env.TEST_DATABASE_URL}}});
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3108';
const suffix = Date.now();
async function req(path, body, cookie='') {
 const r=await fetch(base+path,{method:body ? 'POST':'GET',headers:{'content-type':'application/json',cookie},body:body ? JSON.stringify(body):undefined,redirect:'manual'});
 return {status:r.status,body:await r.json().catch(()=>null),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
async function account(label) {
 const email=`invite-${suffix}-${label}@example.test`;
 const signup=await req('/api/auth/signup',{name:'Test '+label,email,password:'Disposable-test-password',termsAccepted:true});
 assert.equal(signup.status,201);
 const token=new URLSearchParams(new URL(signup.body.verificationUrl).hash.slice(1)).get('token');
 const verified=await req('/api/auth/verify-email',{token});
 assert.equal(verified.status,200);
 return {email,id:signup.body.user.id,cookie:verified.cookie};
}
async function invite(owner, person, role='STAFF') {
 const r=await req('/api/invitations',{email:person.email,role},owner.cookie);
 assert.equal(r.status,201,JSON.stringify(r.body));
 return new URLSearchParams(new URL(r.body.invitationUrl).hash.slice(1)).get('token');
}
try {
 const owner=await account('owner'),staff=await account('staff'),stranger=await account('stranger');
 const farm=await req('/api/farms',{name:'Invitation test farm'},owner.cookie);
 assert.equal(farm.status,201); owner.cookie+='; '+farm.cookie;
 const farmId=farm.body.farm.id;
 const accept=(token,user)=>req('/api/invitations/accept',{token},user?.cookie);
 let token=await invite(owner,staff);
 assert.equal((await accept(token)).status,401);
 assert.equal((await accept(token,stranger)).status,403);
 assert.equal((await accept(token,staff)).status,200);
 assert.equal((await accept(token,staff)).status,400);
 staff.cookie+='; reinwell_farm='+farmId;
 // Different emails share data only after joining the same farm.
 const horse=await req('/api/horses',{name:'Shared invitation fixture'},owner.cookie);
 assert.equal(horse.status,200);
 assert.equal((await req('/api/horses/'+horse.body.id,null,staff.cookie)).status,200);
 const sharedRide=await req('/api/rides',{horseId:horse.body.id,dateTime:new Date().toISOString(),riderName:'Invited fixture staff'},staff.cookie);
 assert.equal(sharedRide.status,200);
 assert.equal(await db.rideLog.count({where:{horseId:horse.body.id,riderName:'Invited fixture staff'}}),1);
 assert.equal((await req('/api/horses/'+horse.body.id,null,stranger.cookie)).status,403);
 const strangerFarm=await req('/api/farms',{name:'Separate invitation fixture farm'},stranger.cookie);
 assert.equal(strangerFarm.status,201);
 const strangerCookie=stranger.cookie+'; '+strangerFarm.cookie;
 assert.equal((await req('/api/horses/'+horse.body.id,null,strangerCookie)).status,404);
 const ownHorse=await req('/api/horses',{name:'Separate email fixture horse'},strangerCookie);
 assert.equal(ownHorse.status,200);
 assert.equal((await req('/api/horses/'+ownHorse.body.id,null,owner.cookie)).status,404);
 assert.equal((await req('/api/horses/'+ownHorse.body.id,null,staff.cookie)).status,404);
 const ownerDirectory=await fetch(base+'/horses',{headers:{cookie:owner.cookie}});
 const ownerHtml=await ownerDirectory.text();
 assert.ok(ownerHtml.includes('Shared invitation fixture'));
 assert.ok(!ownerHtml.includes('Separate email fixture horse'));
 const strangerDirectory=await fetch(base+'/horses',{headers:{cookie:strangerCookie}});
 const strangerHtml=await strangerDirectory.text();
 assert.ok(strangerHtml.includes('Separate email fixture horse'));
 assert.ok(!strangerHtml.includes('Shared invitation fixture'));
 console.log('PASS: separate-email farms have separate data; invited staff share the farm data; outsider reads and listings are blocked');
 assert.equal((await req('/api/invitations',{email:stranger.email,role:'MANAGER'},staff.cookie)).status,403);
 assert.equal((await req('/api/invitations',{email:stranger.email,role:'SUPER_ADMIN'},owner.cookie)).status,400);
 token=await invite(owner,stranger);
 await db.farmInvitation.update({where:{token},data:{expiresAt:new Date(0)}});
 assert.equal((await accept(token,stranger)).status,400);
 token=await invite(owner,stranger);
 await db.farmMember.update({where:{farmId_userId:{farmId,userId:owner.id}},data:{role:'STAFF'}});
 assert.equal((await accept(token,stranger)).status,403);
 await db.farmMember.update({where:{farmId_userId:{farmId,userId:owner.id}},data:{role:'MANAGER'}});
 // Concurrent consumption: one request succeeds, all others reject the same token.
 token=await invite(owner,stranger);
 const results=await Promise.all([accept(token,stranger),accept(token,stranger)]);
 assert.equal(results.filter(r=>r.status===200).length,1,JSON.stringify(results));
 assert.ok(results.every(r=>[200,400].includes(r.status)),JSON.stringify(results));
 assert.equal(await db.farmMember.count({where:{farmId,userId:stranger.id}}),1);
 const removed=await account('removed');
 token=await invite(owner,removed);
 await db.farmMember.create({data:{farmId,userId:removed.id,status:'REMOVED'}});
 assert.equal((await accept(token,removed)).status,403);
 // A second older invite must not promote a member after a staff invite is accepted.
 const multi=await account('multi');
 const managerToken=await invite(owner,multi,'MANAGER');
 const staffToken=await invite(owner,multi,'STAFF');
 assert.equal((await accept(staffToken,multi)).status,200);
 assert.equal((await accept(managerToken,multi)).status,200);
 assert.equal((await db.farmMember.findUnique({where:{farmId_userId:{farmId,userId:multi.id}}})).role,'STAFF');
 for (const origin of ['null','https://evil.example','http://[']) {
  const r=await fetch(base+'/api/invitations',{method:'POST',headers:{origin,cookie:owner.cookie,'content-type':'application/json'},body:'{}'});
  assert.equal(r.status,403);
 }
 console.log('PASS: invitation authentication, email binding, manager-only access, role validation, expiration, inviter demotion, concurrent consumption, removal, stale role invites, invalid origins');
} finally { await db.$disconnect(); }
