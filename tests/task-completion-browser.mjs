import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/local-client';
import bcrypt from 'bcryptjs';
const require = createRequire(import.meta.url), mod = process.env.PLAYWRIGHT_MODULE_PATH ?? 'playwright';
const { chromium } = require(mod), { expect } = require(mod + '/test');
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3188';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
assert.ok(process.env.TEST_DATABASE_URL?.startsWith('file:/private/tmp/'));
const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
const farms = [], users = [];
let browser;
try {
  for (const name of ['Completion farm', 'Foreign farm']) farms.push(await db.farm.create({ data: { name, code: `completion-${name}-${Date.now()}` } }));
  async function member(role, farm) {
    const user = await db.user.create({ data: { email: `completion-${role.toLowerCase()}-${Date.now()}@example.test`, name: `${role} fixture`, password: await bcrypt.hash('Completion-test-123', 10), emailVerifiedAt: new Date() } });
    users.push(user.id);
    return { user, membership: await db.farmMember.create({ data: { farmId: farm.id, userId: user.id, role } }) };
  }
  const staff = await member('STAFF', farms[0]), manager = await member('MANAGER', farms[0]);
  const tasks = [];
  for (const title of ['First assigned task', 'Second assigned task', 'Failed task', 'Lost response task']) tasks.push(await db.farmTask.create({ data: { title, farmId: farms[0].id, assignedMemberId: staff.membership.id } }));
  const other = await db.farmTask.create({ data: { title: 'Manager only task', farmId: farms[0].id, assignedMemberId: manager.membership.id } });
  const foreign = await db.farmTask.create({ data: { title: 'Foreign task', farmId: farms[1].id } });
  const horse = await db.horse.create({ data: { name: 'Completion horse', farmId: farms[0].id } });
  const due = new Date(Date.now() - 86400000);
  const care = await db.vetItem.create({ data: { horseId: horse.id, itemName: 'One-off care', itemType: 'OTHER', nextDueDate: due, assignedMemberId: staff.membership.id } });
  const recurring = await db.vetItem.create({ data: { horseId: horse.id, itemName: 'Recurring care', itemType: 'OTHER', nextDueDate: due, intervalDays: 1, assignedMemberId: staff.membership.id } });
  browser = await chromium.launch({ headless: true, ...(process.env.TEST_CHROME_PATH ? { executablePath: process.env.TEST_CHROME_PATH } : {}) });
  const context = await browser.newContext();
  assert.equal((await context.request.post(base + '/api/auth/login', { headers: { origin: base }, data: { email: staff.user.email, password: 'Completion-test-123' } })).status(), 200);
  await context.addCookies([{ name: 'reinwell_farm', value: farms[0].id, url: base }]);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let navigations = 0;
  page.on('request', request => { if (request.isNavigationRequest() && request.resourceType() === 'document') navigations++; });
  await page.goto(base + '/dashboard');
  const navigationBaseline = navigations;
  const button = title => page.getByRole('button', { name: `Complete ${title}`, exact: true });
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  await page.route('**/api/tasks/complete', async route => {
    if (route.request().postDataJSON().fields.id !== tasks[0].id) return route.continue();
    await hold;
    await route.continue();
  });
  await button(tasks[0].title).click();
  await expect(button(tasks[1].title)).toBeEnabled();
  await expect(page.getByText(/waiting for (approval|confirmation)/i)).toHaveCount(0);
  await button(tasks[1].title).click();
  await expect(button(tasks[1].title)).toBeHidden();
  await expect.poll(async () => Boolean((await db.farmTask.findUniqueOrThrow({ where: { id: tasks[1].id } })).completedAt)).toBe(true);
  release();
  await expect.poll(async () => Boolean((await db.farmTask.findUniqueOrThrow({ where: { id: tasks[0].id } })).completedAt)).toBe(true);
  await expect(page.locator('[data-optimistic-pending="true"]')).toHaveCount(0);
  await page.unroute('**/api/tasks/complete');
  assert.equal(navigations, navigationBaseline, 'No full-page reload on completion');
  await page.reload();
  await expect(button(tasks[0].title)).toHaveCount(0);
  await expect(button(tasks[1].title)).toHaveCount(0);
  await page.route('**/api/tasks/complete', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary save failure.' }) }));
  await button(tasks[2].title).click();
  await expect(page.locator('form p[role=alert]')).toContainText('Previous view restored');
  await expect(button(tasks[2].title)).toBeEnabled();
  assert.equal((await db.farmTask.findUniqueOrThrow({ where: { id: tasks[2].id } })).completedAt, null);
  await page.unroute('**/api/tasks/complete');
  // Persist the request, then lose its response. Timeout must unlock the UI and
  // explain the uncertain outcome; a reload must show the actual saved state.
  let finish;
  const lost = new Promise(resolve => { finish = resolve; });
  await page.route('**/api/tasks/complete', async route => {
    const response = await route.fetch();
    await lost;
    await route.fulfill({ response }).catch(() => {});
  });
  await button(tasks[3].title).click();
  await expect(page.locator('form p[role=alert]').last()).toContainText('request took too long', { timeout: 20000 });
  await expect(button(tasks[3].title)).toBeEnabled();
  await expect(button(tasks[2].title)).toBeEnabled();
  finish();
  await page.unroute('**/api/tasks/complete');
  await page.reload();
  await expect(button(tasks[3].title)).toHaveCount(0);
  await button('One-off care for Completion horse').first().click();
  await expect.poll(()=>db.careCompletion.count({where:{careItemId:care.id}})).toBe(1);
  await expect(page.locator('[data-optimistic-pending="true"]')).toHaveCount(0);
  await page.reload();
  await expect(button('One-off care for Completion horse')).toHaveCount(0);
  assert.equal(await db.careCompletion.count({ where: { careItemId: care.id } }), 1);
  async function post(kind, fields, headers = { origin: base }) {
    const cookie = (await context.cookies()).map(item => `${item.name}=${item.value}`).join('; ');
    return context.request.post(base + '/api/tasks/complete', { headers: { ...headers, cookie }, data: { kind, fields } });
  }
  const original = await db.farmTask.findUniqueOrThrow({ where: { id: tasks[0].id } });
  assert.equal((await post('farm', { id: tasks[0].id })).status(), 200);
  assert.equal((await db.farmTask.findUniqueOrThrow({ where: { id: tasks[0].id } })).completedAt.toISOString(), original.completedAt.toISOString());
  assert.equal((await post('farm', { id: other.id })).status(), 404);
  assert.equal((await post('farm', { id: foreign.id })).status(), 404);
  assert.equal((await post('farm', { id: tasks[2].id }, { origin: 'https://foreign.example' })).status(), 403);
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.post(base + '/api/tasks/complete', { data: { kind: 'farm', fields: { id: tasks[2].id } } })).status(), 401);
  assert.equal((await post('care', { id: recurring.id })).status(), 400);
  assert.equal((await post('care', { id: recurring.id, expectedDueDate: due.toISOString(), cost: '-1' })).status(), 400);
  assert.equal((await post('care', { id: recurring.id, expectedDueDate: due.toISOString() })).status(), 200);
  assert.equal((await post('care', { id: recurring.id, expectedDueDate: due.toISOString() })).status(), 409);
  assert.equal(await db.careCompletion.count({ where: { careItemId: recurring.id } }), 1);
  assert.ok((await db.vetItem.findUniqueOrThrow({ where: { id: recurring.id } })).nextDueDate > new Date());
  await page.reload();
  const next = button('Recurring care for Completion horse').first();
  await expect(next).toBeVisible();
  await expect(next).toBeEnabled();
  assert.deepEqual(errors, []);
  console.log('PASS: staff completion persists after reload; no approval or page reload; unrelated work usable during delayed save; rejection and 15-second lost-response recovery; farm retry idempotency; care stale/duplicate protection; recurrence; authentication, cross-farm and origin boundaries.');
} finally {
  await browser?.close();
  await db.farm.deleteMany({ where: { id: { in: farms.map(farm => farm.id) } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
