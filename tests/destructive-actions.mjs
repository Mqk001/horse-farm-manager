import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/local-client';
import bcrypt from 'bcryptjs';
const require = createRequire(import.meta.url), path = process.env.PLAYWRIGHT_MODULE_PATH ?? 'playwright';
const { chromium } = require(path), { expect } = require(path + '/test');
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3188';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
assert.ok(process.env.TEST_DATABASE_URL?.startsWith('file:/private/tmp/'));
const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
const users = [], farms = [];
let browser;
try {
  const suffix = Date.now();
  for (const name of ['Safety farm', 'Foreign safety farm']) farms.push(await db.farm.create({ data: { name, code: `safety-${suffix}-${farms.length}` } }));
  for (const [name, farmId, role] of [['Safety Manager', farms[0].id, 'MANAGER'], ['Safety Staff', farms[0].id, 'STAFF'], ['Foreign Manager', farms[1].id, 'MANAGER']]) {
    const user = await db.user.create({ data: { name, email: `safety-${suffix}-${users.length}@example.test`, password: await bcrypt.hash('Safety-test-123', 10), emailVerifiedAt: new Date() } });
    const member = await db.farmMember.create({ data: { userId: user.id, farmId, role } }); users.push({ ...user, member });
  }
  const horse = await db.horse.create({ data: { farmId: farms[0].id, name: 'Safety Thunder' } });
  const task = await db.farmTask.create({ data: { farmId: farms[0].id, title: 'Safety completed work', completedAt: new Date(), completedByName: 'Fixture' } });
  browser = await chromium.launch({ headless: true, ...(process.env.TEST_CHROME_PATH ? { executablePath: process.env.TEST_CHROME_PATH } : {}) });
  async function login(user) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    assert.equal((await context.request.post(base + '/api/auth/login', { headers: { origin: base }, data: { email: user.email, password: 'Safety-test-123' } })).status(), 200);
    await context.addCookies([{ name: 'reinwell_farm', value: user.member.farmId, url: base }]); return context;
  }
  const context = await login(users[0]), page = await context.newPage();
  let deletes = 0; page.on('request', r => { if (r.method() === 'DELETE') deletes++; });
  await page.goto(base + `/horses/${horse.id}/edit`);
  await page.getByLabel('Name', { exact: true }).fill('Unsaved name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Discard profile changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unsaved name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Safety Thunder', exact: true, level: 1 })).toBeVisible();
  assert.equal((await db.horse.findUnique({ where: { id: horse.id } })).name, 'Safety Thunder');
  async function openDelete() { await page.getByLabel('More actions', { exact: true }).click(); await page.getByRole('button', { name: 'Delete horse', exact: true }).click(); }
  await openDelete();
  const dialog = page.getByRole('dialog', { name: 'Delete Safety Thunder?' });
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Delete Safety Thunder', exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Type Safety Thunder to confirm/).fill('wrong'); await expect(confirm).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); assert.equal(deletes, 0);
  await expect(page.getByRole('button', { name: 'Delete horse', exact: true })).toBeFocused();
  // Closing the native dialog returns focus to the original trigger.
  await page.getByRole('button', { name: 'Delete horse', exact: true }).click();
  await dialog.getByLabel(/Type Safety Thunder to confirm/).fill('Safety Thunder');
  await expect(confirm).toBeEnabled();
  const rejectDelete = route => route.fulfill({ status: 500, json: { error: 'Simulated deletion failure' } });
  await page.route(`**/api/horses/${horse.id}`, rejectDelete);
  await confirm.click(); await expect(dialog.getByRole('alert')).toContainText('Simulated deletion failure');
  assert.ok(await db.horse.findUnique({ where: { id: horse.id } }));
  await page.unroute(`**/api/horses/${horse.id}`, rejectDelete);
  await confirm.click(); await expect(page.getByRole('heading', { name: 'Your horses', exact: true })).toBeVisible();
  assert.equal(await db.horse.findUnique({ where: { id: horse.id } }), null);

  await page.goto(base + '/team');
  const staffRow = page.locator('li').filter({ has: page.getByText(users[1].email, { exact: true }) }).first();
  await staffRow.getByRole('button', { name: 'Remove', exact: true }).click();
  const group = staffRow.getByRole('group', { name: 'Confirm access change for Safety Staff' });
  await expect(group.getByRole('button', { name: 'Remove Safety Staff', exact: true })).toHaveClass(/button-danger/);
  await group.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal((await db.farmMember.findUnique({ where: { id: users[1].member.id } })).status, 'ACTIVE');
  await page.getByRole('button', { name: 'Dismiss Safety completed work', exact: true }).click();
  const notice = page.getByRole('complementary', { name: 'Undo dismissal', exact: true });
  await expect(notice).toBeVisible();
  assert.ok((await db.farmTask.findUnique({ where: { id: task.id } })).dismissedAt);
  const manifest = JSON.parse(await readFile(new URL('../.next/server/server-reference-manifest.json', import.meta.url), 'utf8'));
  const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === 'restoreDismissedTask' && value.filename === 'app/team/actions.ts'); assert.ok(entry);
  async function restore(context) {
    const cookie = (await context.cookies()).map(value => `${value.name}=${value.value}`).join('; ');
    assert.equal((await context.request.get(base + '/api/me', { headers: { cookie } })).status(), 200);
    const response = await context.request.post(base + '/team', { maxRedirects: 0, headers: { origin: base, cookie }, multipart: { ['$ACTION_ID_' + entry[0]]: '', id: task.id, kind: 'farm' } }); return response.status();
  }
  const staffContext = await login(users[1]), foreignContext = await login(users[2]);
  assert.ok([403, 500].includes(await restore(staffContext)));
  assert.ok([403, 500].includes(await restore(foreignContext)));
  assert.ok((await db.farmTask.findUnique({ where: { id: task.id } })).dismissedAt);
  await notice.getByRole('button', { name: 'Undo dismissal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dismiss Safety completed work', exact: true })).toBeVisible();
  assert.equal((await db.farmTask.findUnique({ where: { id: task.id } })).dismissedAt, null);
  await expect(notice).toHaveCount(0);
  console.log('PASS: discard/keep editing, named typed deletion, Escape cancel, deletion failure recovery/success, named member confirmation, dismissal Undo, and staff/foreign restore denial');
} finally {
  await browser?.close();
  for (const farm of farms) await db.farm.delete({ where: { id: farm.id } });
  for (const user of users) await db.user.delete({ where: { id: user.id } });
  await db.$disconnect();
}
