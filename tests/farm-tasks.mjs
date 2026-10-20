import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/local-client';
import bcrypt from 'bcryptjs';
const url = process.env.TEST_DATABASE_URL;
assert.ok(url?.startsWith('file:/private/tmp/'), 'Use a disposable SQLite database');
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3112';
const db = new PrismaClient({ datasources: { db: { url } } });
const suffix = Date.now();
const manifest = JSON.parse(await readFile(new URL('../.next/server/server-reference-manifest.json', import.meta.url), 'utf8'));
function actionId(name) {
  const entry = Object.entries(manifest.node).find(([, action]) => action.exportedName === name && action.filename === 'app/team/actions.ts');
  assert.ok(entry, `Compiled action ${name}`); return entry[0];
}
async function action(name, values, cookie, path = "/team") {
  const body = new FormData(); body.set('$ACTION_ID_' + actionId(name), '');
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  const response = await fetch(base + path, { method: 'POST', headers: { cookie, origin: base }, body });
  await response.text(); return response.status;
}
async function account(label, farmId, role) {
  const user = await db.user.create({ data: { email: `care-${suffix}-${label.toLowerCase()}@example.test`, name: label, password: await bcrypt.hash('Care-test-123', 10), emailVerifiedAt: new Date() } });
  const member = await db.farmMember.create({ data: { userId: user.id, farmId, role } });
  const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: base }, body: JSON.stringify({ email: user.email, password: 'Care-test-123' }) });
  assert.equal(response.status, 200); await response.text();
  return { user, member, cookie: response.headers.get('set-cookie').split(';')[0] + `; reinwell_farm=${farmId}` };
}
try {
  const farm = await db.farm.create({ data: { name: 'Farm task test', code: `tasks-${suffix}` } });
  const other = await db.farm.create({ data: { name: 'Foreign tasks', code: `tasks-other-${suffix}` } });
  const manager = await account('Manager', farm.id, 'MANAGER');
  const staff = await account('Staff', farm.id, 'STAFF');
  const colleague = await account('Colleague', farm.id, 'STAFF');
  const foreign = await account('Foreign', other.id, 'MANAGER');
  assert.equal((await fetch(base+'/api/team/revision')).status,401);
  assert.equal((await fetch(base+'/api/team/revision',{headers:{cookie:staff.cookie}})).status,403);
  const beforeRevision = await (await fetch(base+'/api/team/revision',{headers:{cookie:manager.cookie}})).json();
  const create = { title: 'Clean the tack room', assignedMemberId: staff.member.id, dueDate: '2026-10-17' };
  assert.equal(await action('createFarmTask', create, staff.cookie), 500);
  assert.equal(await action('createFarmTask', { ...create, title: '  ' }, manager.cookie), 500);
  assert.equal(await action('createFarmTask', { ...create, dueDate: '2026-02-31' }, manager.cookie), 500);
  assert.equal(await action('createFarmTask', { ...create, assignedMemberId: foreign.member.id }, manager.cookie), 500);
  assert.equal(await action('createFarmTask', create, manager.cookie), 200);
  const afterRevision = await (await fetch(base+'/api/team/revision',{headers:{cookie:manager.cookie}})).json();
  assert.notEqual(beforeRevision.revision,afterRevision.revision);
  const task = await db.farmTask.findFirstOrThrow({ where: { farmId: farm.id } });
  const team = await (await fetch(base+'/team', { headers: { cookie: manager.cookie } })).text();
  assert.ok(team.includes('Clean the tack room'));
  assert.ok(team.indexOf('farm-members-heading') < team.lastIndexOf('Invite a teammate'));
  const mine = await (await fetch(base+'/dashboard', { headers: { cookie: staff.cookie } })).text();
  assert.ok(mine.split('aria-label="My tasks"')[1].split('</section>')[0].includes('Clean the tack room'));
  const theirs = await (await fetch(base+'/dashboard', { headers: { cookie: colleague.cookie } })).text();
  assert.ok(!theirs.includes('Clean the tack room'));
  assert.equal(await action('completeFarmTask', { id: task.id }, colleague.cookie), 500);
  assert.equal(await action('completeFarmTask', { id: task.id }, foreign.cookie), 500);
  assert.equal(await action('assignFarmTask', { id: task.id, assignedMemberId: foreign.member.id }, manager.cookie), 500);
  assert.equal(await action('assignFarmTask', { id: task.id, assignedMemberId: colleague.member.id }, manager.cookie), 200);
  assert.equal(await action('completeFarmTask', { id: task.id }, staff.cookie), 500);
  const completions = await Promise.all([action('completeFarmTask', { id: task.id }, colleague.cookie), action('completeFarmTask', { id: task.id }, colleague.cookie)]);
  assert.equal(completions.filter(status => status === 200).length, 2); // Safe idempotent retries retain one original completion.
  assert.equal((await db.farmTask.findUniqueOrThrow({ where: { id: task.id } })).completedByName, 'Colleague');
  const completedTeam = await (await fetch(base+'/team', { headers: { cookie: manager.cookie } })).text();
  assert.ok(completedTeam.includes('Completed work'));
  assert.ok(completedTeam.includes('Dismiss Clean the tack room'));
  assert.equal(await action('dismissCompletedTask', {id:task.id,kind:'farm'}, staff.cookie),500);
  assert.equal(await action('dismissCompletedTask', {id:task.id,kind:'farm'}, foreign.cookie),500);
  assert.equal(await action('dismissCompletedTask', {id:task.id,kind:'farm'}, manager.cookie),200);
  const dismissed = await db.farmTask.findUniqueOrThrow({where:{id:task.id}});
  assert.ok(dismissed.completedAt && dismissed.dismissedAt);
  assert.equal(dismissed.completedByName,'Colleague');
  const reviewedTeam = await (await fetch(base+'/team', { headers: { cookie: manager.cookie } })).text();
  assert.ok(!reviewedTeam.includes('Dismiss Clean the tack room'));
  const horse = await db.horse.create({data:{farmId:farm.id,name:'Review horse'}});
  const completion = await db.careCompletion.create({data:{horseId:horse.id,itemName:'Vaccination review',itemType:'VACCINATION',completedByName:'Staff'}});
  assert.equal(await action('dismissCompletedTask',{id:completion.id,kind:'care'},foreign.cookie),500);
  assert.equal(await action('dismissCompletedTask',{id:completion.id,kind:'care'},manager.cookie),200);
  assert.ok((await db.careCompletion.findUniqueOrThrow({where:{id:completion.id}})).dismissedAt);
  assert.equal(await action('createFarmTask', { title: 'Check gates', assignedMemberId: staff.member.id }, manager.cookie), 200);
  const open = await db.farmTask.findFirstOrThrow({ where: { farmId: farm.id, completedAt: null } });
  assert.equal(await action('dismissCompletedTask',{id:open.id,kind:'farm'},manager.cookie),500);
  const removed = await fetch(base+'/api/team/'+staff.member.id, { method:'DELETE', headers:{cookie:manager.cookie,origin:base} });
  assert.equal(removed.status,200); await removed.text();
  assert.equal((await db.farmTask.findUniqueOrThrow({where:{id:open.id}})).assignedMemberId,null);
  assert.equal(await action('createFarmTask', create, manager.cookie),500);
  assert.equal(await action('assignFarmTask', {id:open.id,assignedMemberId:manager.member.id},manager.cookie),200);
  assert.equal(await action('completeFarmTask',{id:open.id},manager.cookie),200);
  console.log('PASS: text tasks without horses, assignment, My tasks visibility, permissions/isolation, replay/concurrency protection, removal cleanup, completion history');
} finally { await db.$disconnect(); }
