import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';
import LambdafsModule from '@sparticuz/chromium/build/lambdafs.js';
const Lambdafs = LambdafsModule.default;
import { createApp } from '../server.js';

// The npm browser package contains Amazon Linux libraries. Extract them for the
// Debian test sandbox too; no system installation or browser CDN is required.
await Lambdafs.inflate(new URL('../node_modules/@sparticuz/chromium/bin/al2.tar.br', import.meta.url).pathname);
await Lambdafs.inflate(new URL('../node_modules/@sparticuz/chromium/bin/al2023.tar.br', import.meta.url).pathname);
process.env.LD_LIBRARY_PATH = `/tmp/al2023/lib:/tmp/al2/lib:${process.env.LD_LIBRARY_PATH || ''}`;
process.env.FONTCONFIG_PATH ||= '/tmp/fonts';
const { server } = createApp({ env: { DEMO_MODE: 'true', ESHOBE_PUBLIC_ORIGIN: 'https://preview.example' } });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await playwright.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
await mkdir('test-results', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base); await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('.menu-grid .item').count(), 8);
  assert.equal(await page.locator('.price').first().textContent(), '5.00 $');
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.locator('.item').first().click();
  await page.locator('#item-detail[open]').waitFor();
  assert.equal(await page.locator('#detail-name').textContent(), 'Espresso');
  await page.screenshot({ path: 'test-results/detail.png' });
  await page.keyboard.press('Escape'); await page.locator('#item-detail').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.dataset.index), '0');
  await page.locator('[data-action="favorite"]').first().click();
  assert.equal(await page.locator('[data-action="favorite"]').first().getAttribute('aria-pressed'), 'true');
  await page.reload();
  assert.equal(await page.locator('[data-action="favorite"]').first().getAttribute('aria-pressed'), 'true');
  await page.locator('[data-action="favorite"]').first().click();
  await page.locator('.item').nth(3).click();
  await page.locator('.detail__cta').click();
  await page.locator('#checkout-dialog[open]').waitFor();
  assert.equal(await page.locator('#checkout-product').textContent(), 'Cappuccino');
  assert.equal(await page.locator('.checkout__submit').isDisabled(), true);
  assert.match(await page.locator('#checkout-dialog .notice').textContent(), /design preview/);
  const checkout = await page.request.post(`${base}/api/checkout`, { data: {} });
  assert.equal(checkout.status(), 403);
  await page.keyboard.press('Escape'); await page.locator('#checkout-dialog').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base); await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.locator('.item').nth(4).click();
  assert.equal(await page.locator('#detail-name').textContent(), 'Latte');
  await page.screenshot({ path: 'test-results/mobile-detail.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: desktop/mobile layouts, detail, Escape/focus, persistent favourites, honest preview checkout; screenshots in test-results/.');
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
