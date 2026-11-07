import assert from 'node:assert/strict';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';
import LambdafsModule from '@sparticuz/chromium/build/lambdafs.js';
import { createApp } from '../server.js';
import { startMockCms, API_KEY, SITE_ID, RECEIPT_SECRET, REVALIDATE_SECRET, variable } from './fixtures.mjs';

await LambdafsModule.default.inflate(new URL('../node_modules/@sparticuz/chromium/bin/al2.tar.br', import.meta.url).pathname);
await LambdafsModule.default.inflate(new URL('../node_modules/@sparticuz/chromium/bin/al2023.tar.br', import.meta.url).pathname);
process.env.LD_LIBRARY_PATH = `/tmp/al2023/lib:/tmp/al2/lib:${process.env.LD_LIBRARY_PATH || ''}`;
process.env.FONTCONFIG_PATH ||= '/tmp/fonts';
const cms = await startMockCms();
const { server } = createApp({ env: { ESHOBE_CMS_URL: cms.origin, ESHOBE_API_KEY: API_KEY, ESHOBE_SITE_ID: SITE_ID, ESHOBE_SITE_DOMAIN: 'shop.example', ESHOBE_PUBLIC_ORIGIN: 'https://shop.example', ESHOBE_RECEIPT_SECRET: RECEIPT_SECRET, ESHOBE_REVALIDATE_SECRET: REVALIDATE_SECRET } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await playwright.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/products/variable-coffee`);
  await page.locator('#product-page-variation').selectOption('large-stable');
  assert.match(await page.locator('.product-page__price').textContent(), /۲۳۰٬۰۰/);
  await page.locator('[data-buy-index="0"]').click();
  assert.equal(await page.locator('#checkout-variation').inputValue(), 'large-stable');
  await page.locator('#checkout-form [name="name"]').fill('علی رضایی');
  await page.locator('#checkout-form [name="phone"]').fill('۰۹۱۲۱۲۳۴۵۶۷');
  await page.locator('#checkout-form [name="quantity"]').fill('2');
  await page.locator('#checkout-form [name="couponCode"]').fill('WELCOME');
  await page.locator('#checkout-form [name="note"]').fill('لطفاً تازه باشد');
  await page.screenshot({ path: 'test-results/checkout-fa.png', fullPage: true });
  await page.locator('.checkout__submit').click();
  await page.waitForURL(/\/checkout\//);
  assert.equal(cms.state.checkouts.length, 1);
  const request = cms.state.checkouts[0];
  assert.equal(request.body.product, variable.id); assert.equal(request.body.variation, 'large-stable'); assert.equal(request.body.quantity, 2);
  assert.equal(request.body.name, 'علی رضایی'); assert.equal(request.body.gateway, 'test-psp');
  assert.equal(request.body.price, undefined); assert.equal(request.body.total, undefined); assert.equal(request.body.site, undefined);
  assert.equal(request.headers.authorization, undefined); assert.equal(request.headers.cookie, undefined);
  assert.ok((await page.locator('.receipt').textContent()).includes('۵۰۵٬۰۰۰ تومان'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-results/receipt-fa.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-results/receipt-mobile.png', fullPage: true });

  // Every response shape, including 503 + ok:true + pending, is exercised.
  for (const mode of ['error', 'rate', 'pending', 'redirect']) {
    cms.state.mode = mode;
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(`${base}/products/coffee`);
    await page.locator('[data-buy-index="0"]').click();
    await page.locator('#checkout-form [name="name"]').fill('آزمون');
    await page.locator('#checkout-form [name="phone"]').fill('09121234567');
    if (mode === 'redirect') await page.route('https://psp.example/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Mock PSP — no real payment</h1>' }));
    await page.locator('.checkout__submit').click();
    if (mode === 'error') { await page.locator('#checkout-error:not([hidden])').waitFor(); assert.match(await page.locator('#checkout-error').textContent(), /موجود/); assert.equal(await page.locator('.checkout__submit').isEnabled(), true); }
    if (mode === 'rate') { await page.locator('#checkout-error:not([hidden])').waitFor(); assert.match(await page.locator('#checkout-error').textContent(), /صبر/); }
    if (mode === 'pending') { await page.waitForURL(/\/checkout\//); assert.ok((await page.locator('.receipt').textContent()).includes('هنوز پرداخت نشده')); }
    if (mode === 'redirect') { await page.waitForURL('https://psp.example/pay/test'); assert.match(await page.locator('h1').textContent(), /Mock PSP/); await page.unroute('https://psp.example/**'); }
  }
  cms.state.mode = 'confirmation';
  await page.goto(`${base}/`);
  const contact = page.locator('.cms-form');
  await contact.locator('[name="name"]').fill('مریم');
  await contact.locator('[name="email"]').fill('maryam@example.com');
  await contact.locator('[name="message"]').fill('پیام آزمایشی');
  await contact.locator('[name="consent"]').check();
  await contact.locator('[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('.form-status')?.textContent.includes('پیام دریافت شد'));
  assert.equal(cms.state.forms.length, 1);
  assert.equal(cms.state.forms[0].form, 'form-1');
  assert.ok(cms.state.forms[0].submissionData.some((row) => row.field === '__eshobe_website_check' && row.value === ''));
  assert.ok(cms.state.forms[0].submissionData.some((row) => row.field === 'consent' && row.value === 'true'));
  const missing = await page.request.get(`${base}/en`);
  assert.equal(missing.status(), 404);
  assert.match(await missing.text(), /could not be found/);
  assert.deepEqual(errors, []);
  console.log('Connected browser checks passed: RTL variation selection, real proxy checkout, receipt/totals, mobile receipt, 409/429/pending/PSP redirect, CMS form confirmation and no browser errors.');
} finally { await browser.close(); await new Promise((r) => server.close(r)); await cms.close(); }
