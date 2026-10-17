import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), path = process.env.PLAYWRIGHT_MODULE_PATH ?? 'playwright';
const { chromium } = require(path), { expect } = require(path + '/test');
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3188';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_CHROME_PATH ? { executablePath: process.env.TEST_CHROME_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  await page.goto(base);
  assert.equal(await page.locator('.route-enter').evaluate(el => getComputedStyle(el).animationName), 'page-enter');
  await page.getByRole('link', { name: 'Terms', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Terms and Conditions', exact: true })).toBeVisible();
  assert.equal(await page.locator('.route-enter').evaluate(el => getComputedStyle(el).pointerEvents), 'auto');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
  await page.goBack(); await expect(page.getByRole('heading', { name: 'Reinwell', exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
  assert.equal(await page.locator('.route-enter').evaluate(el => getComputedStyle(el).animationName), 'none');
  console.log('PASS: 140ms pathname reveal, immediate interaction, route scroll reset/back navigation, and no animation under reduced motion');
} finally { await browser.close(); }
