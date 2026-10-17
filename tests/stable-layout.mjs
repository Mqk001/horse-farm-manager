import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const modulePath = process.env.PLAYWRIGHT_MODULE_PATH ?? 'playwright';
const { chromium } = require(modulePath), { expect } = require(modulePath + '/test');
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3188';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_CHROME_PATH ? { executablePath: process.env.TEST_CHROME_PATH } : {}) });
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/api/auth/google', async route => { await held; await route.fulfill({ json: { enabled: true } }); });
    await page.goto(base + '/login');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.route-enter').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    await expect(page.getByText('Checking Google sign-in', { exact: true })).toBeAttached();
    const before = await page.locator('.login-card').boundingBox();
    const emailBefore = await page.getByLabel('Email address', { exact: true }).boundingBox();
    release();
    await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeVisible();
    const after = await page.locator('.login-card').boundingBox();
    const emailAfter = await page.getByLabel('Email address', { exact: true }).boundingBox();
    assert.ok(Math.abs(before.y - after.y) < 1);
    assert.ok(Math.abs(before.height - after.height) < 1);
    assert.ok(Math.abs(emailBefore.y - emailAfter.y) < 1);
    console.log(`PASS ${width}px: delayed Google control leaves card and email field positions unchanged`);
    await page.close();
  }
} finally { await browser.close(); }
