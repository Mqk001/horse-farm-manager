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
let browser, user, farm;
try {
  farm = await db.farm.create({ data: { name: 'Navigation farm', code: `navigation-${Date.now()}` } });
  user = await db.user.create({ data: { name: 'Navigation manager', email: `navigation-${Date.now()}@example.test`, password: await bcrypt.hash('Navigation-test-123', 10), emailVerifiedAt: new Date() } });
  const member = await db.farmMember.create({ data: { farmId: farm.id, userId: user.id, role: 'MANAGER' } });
  browser = await chromium.launch({ headless: true, ...(process.env.TEST_CHROME_PATH ? { executablePath: process.env.TEST_CHROME_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  assert.equal((await context.request.post(base + '/api/auth/login', { headers: { origin: base }, data: { email: user.email, password: 'Navigation-test-123' } })).status(), 200);
  await context.addCookies([{ name: 'reinwell_farm', value: farm.id, url: base }]);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let documents = 0;
  page.on('request', request => { if (request.isNavigationRequest() && request.resourceType() === 'document') documents++; });
  let warmReady;
  // Model a slower connection: the route takes at least 700ms on the wire.
  await page.route('**/horses?*', async route => {
    if (route.request().headers().rsc !== '1') return route.continue();
    await new Promise(resolve => setTimeout(resolve, 700));
    if (!warmReady) return route.continue();
    const response = await route.fetch();
    const text = await response.text();
    await route.fulfill({ response });
    if (text.includes('Your horses')) warmReady();
  });
  await page.goto(base + '/dashboard');
  await expect(page.getByText('Navigation farm', { exact: true })).toBeVisible();
  const firstDocumentCount = documents;
  const startCold = Date.now();
  // DOM click has no preceding pointer/focus intent, so this is a cold route.
  await page.getByRole('link', { name: 'Horses', exact: true }).evaluate(link => link.click());
  await expect(page.getByRole('heading', { name: 'Your horses', exact: true })).toBeVisible({ timeout: 15000 });
  const coldMs = Date.now() - startCold;
  assert.ok(coldMs >= 650, 'Cold route includes the modeled transfer delay');
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(31000); // Expire the previous prefetched route.
  await page.clock.resume();
  const prefetched = new Promise(resolve => { warmReady = resolve; });
  await page.getByRole('link', { name: 'Horses', exact: true }).hover();
  await prefetched;
  await page.waitForTimeout(100);
  const startWarm = Date.now();
  await page.getByRole('link', { name: 'Horses', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your horses', exact: true })).toBeVisible({ timeout: 15000 });
  const warmMs = Date.now() - startWarm;
  assert.ok(warmMs < coldMs / 2, `Prefetched navigation ${warmMs}ms vs cold ${coldMs}ms`);
  assert.equal(documents, firstDocumentCount, 'Sidebar changes do not reload the document');

  const teamContext = await browser.newContext({ storageState: await context.storageState(), viewport: { width: 1440, height: 1000 } });
  const teamPage = await teamContext.newPage();
  teamPage.on('pageerror', error => errors.push(error.message));
  teamPage.on('request', request => { if (request.isNavigationRequest() && request.resourceType() === 'document') documents++; });
  await teamPage.goto(base + '/team');
  await expect(teamPage.getByRole('heading', { name: 'Your team', exact: true })).toBeVisible();
  const teamDocuments = documents;
  await teamPage.waitForTimeout(300);
  await db.farmTask.create({ data: { farmId: farm.id, assignedMemberId: member.id, title: 'New background task' } });
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  let checkStarted;
  const started = new Promise(resolve => { checkStarted = resolve; });
  await teamPage.route('**/api/team/revision', async route => {
    checkStarted();
    await hold;
    await route.continue();
  });
  await teamPage.waitForTimeout(5500);
  await teamPage.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
  await started;
  await expect(teamPage.getByRole('heading', { name: 'Your team', exact: true })).toBeVisible();
  await expect(teamPage.getByLabel('New task', { exact: true })).toBeEnabled();
  assert.equal(documents, teamDocuments, 'Checking on tab focus never reloads the document');
  release();
  await expect(teamPage.getByRole('status', { name: 'Team updates' })).toBeVisible();
  assert.equal(documents, teamDocuments, 'New work produces a notice, not a forced reload');
  await teamPage.getByRole('link', { name: 'Show latest', exact: true }).click();
  await expect(teamPage.locator('option').filter({ hasText: 'New background task · Farm task' })).toHaveCount(1);
  await expect(teamPage.getByRole('status', { name: 'Team updates' })).toHaveCount(0);
  assert.equal(documents, teamDocuments + 1, 'Only the explicit Show latest link reloads the document');
  assert.deepEqual(errors, []);
  console.log(`PASS: delayed cold route ${coldMs}ms; intent-prefetched route ${warmMs}ms; sidebar document reloads 0; Team stays interactive during its update check, shows a nonblocking notice and refreshes only on explicit request; no browser errors.`);
} finally {
  await browser?.close();
  if (farm) await db.farm.delete({ where: { id: farm.id } });
  if (user) await db.user.delete({ where: { id: user.id } });
  await db.$disconnect();
}
