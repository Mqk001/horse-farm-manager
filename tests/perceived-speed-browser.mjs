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
let browser, farm, user;
const baseline = process.env.PERFORMANCE_BASELINE === '1';
try {
  farm = await db.farm.create({ data: { name: 'Speed farm', code: `speed-${Date.now()}` } });
  user = await db.user.create({ data: { name: 'Speed manager', email: `speed-${Date.now()}@example.test`, password: await bcrypt.hash('Speed-test-123', 10), emailVerifiedAt: new Date() } });
  await db.farmMember.create({ data: { farmId: farm.id, userId: user.id, role: 'MANAGER' } });
  browser = await chromium.launch({ headless: true, ...(process.env.TEST_CHROME_PATH ? { executablePath: process.env.TEST_CHROME_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: Number(process.env.TEST_VIEWPORT_WIDTH ?? 1440), height: 1000 } });
  // Isolate cold/intent navigation from automatic background warming.
  await context.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }));
  assert.equal((await context.request.post(base + '/api/auth/login', { headers: { origin: base }, data: { email: user.email, password: 'Speed-test-123' } })).status(), 200);
  await context.addCookies([{ name: 'reinwell_farm', value: farm.id, url: base }]);
  const results = [];
  for (const [from, to, label, heading] of [
    ['/dashboard', '/horses', 'Horses', 'Your horses'],
    ['/horses', '/care', 'Care schedule', 'Care schedule'],
    ['/care', '/team', 'Team', 'Your team'],
    ['/team', '/dashboard', 'Overview', /Good (morning|afternoon|evening)/],
  ]) {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + from);
    await expect(page.getByText('Speed farm', { exact: true })).toBeAttached();
    await expect.poll(() => page.getByRole('link', { name: 'Team', exact: true, includeHidden: true }).count()).toBe(1);
    await page.locator('h1').waitFor();
    const previous = await page.locator('h1').textContent();
    await page.locator('aside nav').evaluate(el => { el.dataset.shellProbe = 'retained'; });
    // Warm the shared loading boundary, then hold the destination response.
    // A keyboard/DOM click avoids intent prefetch masking the cold-route case.
    await page.waitForTimeout(150);
    await page.route(`**${to}?*`, async route => {
      if (route.request().headers().rsc === '1') await new Promise(resolve => setTimeout(resolve, 900));
      await route.continue();
    });
    let documents = 0;
    page.on('request', request => { if (request.resourceType() === 'document') documents++; });
    if (Number(process.env.TEST_VIEWPORT_WIDTH ?? 1440) < 1024) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    const start = Date.now();
    await page.getByRole('link', { name: label, exact: true }).evaluate(el => el.click());
    await page.waitForTimeout(150);
    const retained = await page.locator('h1').filter({ hasText: previous }).isVisible();
    const feedback = await page.getByRole('status').filter({ hasText: `Opening ${label}` }).isVisible();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    const readyMs = Date.now() - start;
    assert.equal(await page.locator('[data-shell-probe=retained]').count(), 1);
    assert.equal(documents, 0);
    assert.deepEqual(errors, []);
    if (!baseline) { assert.ok(retained, `${to}: existing page remains visible during transfer`); assert.ok(feedback, `${to}: immediate navigation feedback`); }
    results.push({ from, to, retainedAt150ms: retained, feedbackAt150ms: feedback, readyMs, documents });
    await page.close();
  }
  console.log(JSON.stringify({ baseline, modeledTransferDelayMs: 900, results }, null, 2));
} finally {
  await browser?.close();
  if (farm) await db.farm.delete({ where: { id: farm.id } });
  if (user) await db.user.delete({ where: { id: user.id } });
  await db.$disconnect();
}
