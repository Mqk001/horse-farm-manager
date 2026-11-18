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
const baseline = process.env.PERFORMANCE_BASELINE === '1';
const width = Number(process.env.TEST_VIEWPORT_WIDTH ?? 1440);
let browser, farm, user;
try {
  farm = await db.farm.create({ data: { name: 'Daily speed farm', code: `daily-${Date.now()}` } });
  user = await db.user.create({ data: { name: 'Daily manager', email: `daily-${Date.now()}@example.test`, password: await bcrypt.hash('Daily-test-123', 10), emailVerifiedAt: new Date() } });
  const member = await db.farmMember.create({ data: { farmId: farm.id, userId: user.id, role: 'MANAGER' } });
  const horse = await db.horse.create({ data: { farmId: farm.id, name: 'Daily horse' } });
  let firstTask;
  for (let i = 0; i < 30; i++) {
    await db.horse.create({ data: { farmId: farm.id, name: `Daily horse ${i}` } });
    await db.vetItem.create({ data: { horseId: horse.id, itemName: `Daily care ${i}`, itemType: 'OTHER', nextDueDate: new Date(), assignedMemberId: member.id } });
    const task = await db.farmTask.create({ data: { farmId: farm.id, title: `Daily work ${i}`, assignedMemberId: member.id } });
    if (i === 0) firstTask = task;
  }
  browser = await chromium.launch({ headless: true, ...(process.env.TEST_CHROME_PATH ? { executablePath: process.env.TEST_CHROME_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  assert.equal((await context.request.post(base + '/api/auth/login', { headers: { origin: base }, data: { email: user.email, password: 'Daily-test-123' } })).status(), 200);
  await context.addCookies([{ name: 'reinwell_farm', value: farm.id, url: base }]);
  if (process.env.TEST_SERVER_TIMINGS === '1') {
    const results = [];
    for (const route of ['/api/me', '/dashboard', '/horses', '/care', '/team']) {
      const times = [];
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        const cookie = (await context.cookies()).map(item => `${item.name}=${item.value}`).join('; ');
        const response = await context.request.get(base + route, { headers: { cookie } });
        assert.equal(response.status(), 200);
        await response.body();
        times.push(Date.now() - start);
      }
      results.push({ route, timesMs: times });
    }
    console.log(JSON.stringify({ modeledSerialReadDelayMs: 80, results }, null, 2));
  } else {
  const page = await context.newPage(), errors = [], warm = new Set(), requests = [];
  page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`));
  // Model a 500ms route transfer. A real pointer hover never precedes the click.
  await page.route('**/*', async route => {
    if (route.request().headers().rsc !== '1') return route.continue();
    await new Promise(resolve => setTimeout(resolve, 500));
    const response = await route.fetch();
    const body = await response.body();
    requests.push({ path: new URL(route.request().url()).pathname, prefetch: route.request().headers()['next-router-prefetch'], full: body.toString().includes('Your team') || body.toString().includes('Your horses') || body.toString().includes('Care schedule') || body.toString().includes('Farm overview') });
    await route.fulfill({ response, body });
    if (!route.request().headers()['next-router-prefetch'] && requests.at(-1).full) warm.add(new URL(route.request().url()).pathname);
  });
  await page.goto(base + '/dashboard');
  await expect(page.getByRole('link', { name: 'Team', exact: true, includeHidden: true })).toBeAttached();
  if (baseline) await page.waitForTimeout(2500);
  else await expect.poll(() => ['/horses', '/care', '/team'].every(path => warm.has(path)), { timeout: 15000 }).toBe(true);
  let documents = 0, rsc = 0;
  page.on('request', request => { if (request.resourceType() === 'document') documents++; if (request.headers().rsc === '1') rsc++; });
  const results = [];
  for (const [label, heading] of [['Horses', 'Your horses'], ['Care schedule', 'Care schedule'], ['Team', 'Your team'], ['Overview', /Good (morning|afternoon|evening)/]]) {
    if (width < 1024) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    const beforeRequests = rsc, start = Date.now();
    await page.getByRole('link', { name: label, exact: true }).evaluate(el => el.click());
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    const elapsedMs = Date.now() - start;
    results.push({ label, elapsedMs, clickRequests: rsc - beforeRequests });
    if (process.env.PERFORMANCE_DIAGNOSTIC === '1') console.error(JSON.stringify({ result: results.at(-1), requests }));
    if (!baseline && process.env.PERFORMANCE_DIAGNOSTIC !== '1') assert.ok(elapsedMs < 500, `${label}: warmed navigation must finish before the modeled transfer delay (${elapsedMs}ms)`);
  }
  if (!baseline) {
    // Team was prefetched before this write. Completion must invalidate that
    // snapshot as well as the current Dashboard's 15-second revisit entry.
    const reconciled = page.waitForResponse(response => new URL(response.url()).pathname === '/dashboard' && response.request().headers().rsc === '1');
    await page.getByRole('button', { name: 'Complete Daily work 0', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Complete Daily work 0', exact: true })).toBeHidden();
    await (await reconciled).body();
    if (width < 1024) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('link', { name: 'Team', exact: true }).evaluate(el => el.click());
    await expect(page.getByRole('heading', { name: 'Your team', exact: true })).toBeVisible();
    await expect(page.locator(`option[value="farm:${firstTask.id}"]`)).toHaveCount(0);
  }
  assert.equal(documents, 0); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ baseline, width, modeledTransferDelayMs: 500, results, documents }, null, 2));
  }
} finally {
  await browser?.close();
  if (farm) await db.farm.delete({ where: { id: farm.id } });
  if (user) await db.user.delete({ where: { id: user.id } });
  await db.$disconnect();
}
