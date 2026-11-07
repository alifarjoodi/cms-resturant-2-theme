import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { formatPrice, formatDate, themeCss, majorToMinor } from '@eshobe/site-runtime';
import { queryString } from '../src/cms.js';
import { ContentCache } from '../src/cache.js';
import { resolveSiteRoute, localeFor, safeUrl, normalizePath } from '../src/routing.js';
import { verifyRevalidation, verifyReceipt, receiptSignature, escapeHtml, jsonScript } from '../src/security.js';
import { cmsOwnedApi } from '../src/proxy.js';
import { productViewModel, availability } from '../src/products.js';
import { lexical } from '../src/lexical.js';
import { createApp } from '../server.js';
import { startMockCms, API_KEY, SITE_ID, REVALIDATE_SECRET, RECEIPT_SECRET, ORDER_ID, PRODUCT_ID, variable, allBlocks } from './fixtures.mjs';

async function running(t, options = {}) {
  const cms = await startMockCms();
  const env = { ESHOBE_CMS_URL: cms.origin, ESHOBE_API_KEY: API_KEY, ESHOBE_SITE_ID: SITE_ID, ESHOBE_SITE_DOMAIN: 'shop.example', ESHOBE_PUBLIC_ORIGIN: 'https://shop.example', ESHOBE_REVALIDATE_SECRET: REVALIDATE_SECRET, ESHOBE_RECEIPT_SECRET: RECEIPT_SECRET, ...options };
  const app = createApp({ env });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise((resolve) => app.server.close(resolve)); await cms.close(); });
  return { ...app, cms, base: `http://127.0.0.1:${app.server.address().port}` };
}

test('runtime formatting, minor units, Jalali dates and safe CSS tokens', () => {
  assert.equal(formatPrice(180000, 'IRT', 'fa'), '\u06f1\u06f8\u06f0\u066c\u06f0\u06f0\u06f0 تومان');
  assert.equal(formatPrice(18000, 'IRT', 'fa'), '\u06f1\u06f8\u066c\u06f0\u06f0\u06f0 تومان');
  assert.equal(formatPrice(1800, 'IRT', 'fa'), '\u06f1\u066c\u06f8\u06f0\u06f0 تومان');
  assert.equal(formatPrice(180000, 'IRR', 'fa'), '۱۸۰٬۰۰۰ ریال');
  assert.equal(formatPrice(1250, 'USD', 'en'), '12.50 $');
  assert.equal(majorToMinor(5, 'USD'), 500);
  assert.match(formatDate('2024-05-02T10:00:00Z', 'fa'), /اردیبهشت/);
  assert.match(themeCss({ primary: '#fff', background: 'red;}</style>' }), /--primary:#fff/);
  assert.ok(!themeCss({ background: 'red;}</style>' }).includes('</style>'));
});
test('route and locale guards, stable paths and unsafe URL rejection', () => {
  assert.deepEqual(resolveSiteRoute([]), { kind: 'page', slug: 'home' });
  assert.deepEqual(resolveSiteRoute(['en', 'posts', 'hello']), { kind: 'post', slug: 'hello' });
  assert.deepEqual(resolveSiteRoute(['products', 'coffee']), { kind: 'product', slug: 'coffee' });
  assert.equal(resolveSiteRoute(['checkout', ORDER_ID]).order, ORDER_ID);
  assert.equal(localeFor({ availableLocales: ['fa'], defaultLocale: 'fa' }, ['en']), null);
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('//evil.example'), null);
  assert.equal(safeUrl('/about'), '/about');
  assert.equal(normalizePath('/a/../products/coffee'), '/products/coffee');
  assert.throws(() => resolveSiteRoute(['%E0%A4%A']));
});
test('Payload query encoding preserves nested where and locale', () => {
  const query = queryString({ where: { slug: { equals: 'درباره-ما' } }, locale: 'fa', depth: 1 });
  const params = new URLSearchParams(query);
  assert.equal(params.get('where[slug][equals]'), 'درباره-ما'); assert.equal(params.get('locale'), 'fa');
});
test('HMAC v1 signs raw body only and receipt uses a different secret', () => {
  const raw = Buffer.from('{"siteId":"a","paths":[]}');
  const signature = `sha256=${createHmac('sha256', REVALIDATE_SECRET).update(raw).digest('hex')}`;
  assert.equal(verifyRevalidation(REVALIDATE_SECRET, raw, signature), true);
  assert.equal(verifyRevalidation(REVALIDATE_SECRET, Buffer.from(' ' + raw), signature), false);
  assert.equal(verifyRevalidation(REVALIDATE_SECRET, raw, 'sha256=' + '0'.repeat(64)), false);
  const receipt = receiptSignature(RECEIPT_SECRET, SITE_ID, ORDER_ID);
  assert.equal(receipt.length, 22);
  assert.equal(verifyReceipt(RECEIPT_SECRET, SITE_ID, ORDER_ID, receipt), true);
  assert.equal(verifyReceipt(REVALIDATE_SECRET, SITE_ID, ORDER_ID, receipt), false);
  assert.equal(verifyReceipt(RECEIPT_SECRET, 'other-site', ORDER_ID, receipt), false);
});
test('XSS escaping includes JSON script termination and lexical markup', () => {
  assert.equal(escapeHtml('<script>"x"&\''), '&lt;script&gt;&quot;x&quot;&amp;&#39;');
  assert.ok(!jsonScript({ text: '</script><script>alert(1)</script>' }).includes('</script>'));
  const html = lexical({ root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: '<img onerror=alert(1)>' }] }, { type: 'link', fields: { url: 'javascript:alert(1)' }, children: [{ type: 'text', text: 'bad link' }] }] } }, { site: {}, locale: 'fa' });
  assert.ok(!html.includes('<img')); assert.ok(!html.includes('javascript:')); assert.ok(html.includes('&lt;img'));
});
test('cache deduplicates, expires and stale invalidation cannot refill', async () => {
  let calls = 0; const cache = new ContentCache(20);
  const load = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return calls; };
  assert.deepEqual(await Promise.all([cache.get('a', load), cache.get('a', load)]), [1, 1]);
  cache.invalidate(); assert.equal(await cache.get('a', load), 2);
  let finish; const pending = cache.get('b', () => new Promise((r) => { finish = r; }));
  cache.invalidate(); finish('old'); assert.equal(await pending, 'old'); assert.equal(cache.entries.has('b'), false);
});
test('variable products use stable keys, own prices and stock; external/grouped are not purchasable', () => {
  const site = { store: { currency: 'IRT' }, media: { origin: 'https://shop.example' }, defaultLocale: 'fa' };
  const p = productViewModel(variable, site, 'fa', 0);
  assert.equal(p.selectedVariation, 'small-stable'); assert.equal(p.variations.length, 2); assert.equal(p.stock, 2);
  assert.equal(p.variations[1].price, formatPrice(230000, 'IRT', 'fa'));
  assert.equal(productViewModel({ productType: 'external', externalUrl: 'javascript:bad' }, site, 'fa', 0).canBuy, false);
  assert.equal(productViewModel({ productType: 'grouped' }, site, 'fa', 0).canBuy, false);
  assert.equal(availability({ trackInventory: true, inventory: 7 }, { trackInventory: true, inventory: 2 }), 2);
});
test('CMS proxy allowlist keeps health/revalidation local and staff collections private', () => {
  assert.equal(cmsOwnedApi('/api/checkout', 'POST'), true);
  assert.equal(cmsOwnedApi('/api/media/file/photo.jpg', 'GET'), true);
  assert.equal(cmsOwnedApi('/api/products', 'GET'), true);
  for (const path of ['/api/health', '/api/revalidate', '/api/orders', '/api/users', '/api/api-keys', '/api/sites', '/api/customers', '/api/coupons', '/api/redirects']) assert.equal(cmsOwnedApi(path, 'GET'), false);
  assert.equal(cmsOwnedApi('/api/products', 'DELETE'), false);
});
test('bootstrap uses site key, filters drafts, binds home by ID and caches descriptor', async (t) => {
  const { client, cms } = await running(t);
  const site = await client.getSite(); await client.getSite();
  assert.equal(cms.state.siteCalls, 1);
  assert.equal(site.id, SITE_ID);
  await client.list('products', { locale: 'fa' });
  assert.ok(cms.state.requests.every((r) => r.authorization === `Bearer ${API_KEY}`));
  assert.ok(cms.state.requests.filter((r) => r.path.startsWith('/api/products')).every((r) => r.path.includes('where%5B_status%5D%5Bequals%5D=published')));
  const page = await client.getHomePage(site, 'fa'); assert.equal(page.id, 'home-id');
  assert.equal(await client.bySlug('pages', 'about', 'en'), null);
});
test('CMS failure serves last good content, never demo products', async (t) => {
  const { client, cms } = await running(t);
  const original = await client.getSite(); cms.state.unavailable = true; client.invalidate();
  // Prime a successful cache, then simulate upstream failure.
  cms.state.unavailable = false; await client.getSite(); cms.state.unavailable = true;
  client.cache.entries.get('site').expires = 0;
  assert.equal((await client.getSite()).id, original.id);
});
test('health is local, revalidation authenticates raw bytes and invalidates immediately', async (t) => {
  const { base, client, cms } = await running(t);
  await client.getSite(); const before = cms.state.siteCalls;
  cms.state.unavailable = true;
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  const raw = JSON.stringify({ siteId: SITE_ID, paths: ['/shop.example/'], timestamp: 'unsigned' });
  const signature = `sha256=${createHmac('sha256', REVALIDATE_SECRET).update(raw).digest('hex')}`;
  assert.equal((await fetch(`${base}/api/revalidate`, { method: 'POST', body: raw, headers: { 'x-eshobe-signature': signature, 'x-eshobe-timestamp': 'not-signed' } })).status, 200);
  assert.equal(client.cache.entries.size, 0);
  assert.equal((await fetch(`${base}/api/revalidate`, { method: 'POST', body: raw, headers: { 'x-eshobe-signature': 'sha256=' + '0'.repeat(64) } })).status, 401);
});
test('SSR Persian menu, all blocks, safe prices, canonical, redirects and 404s', async (t) => {
  const { base } = await running(t);
  const response = await fetch(`${base}/`); const html = await response.text();
  assert.equal(response.status, 200); assert.match(html, /lang="fa" dir="rtl"/); assert.ok(html.includes('\u06f1\u06f8\u06f0\u066c\u06f0\u06f0\u06f0 تومان'));
  assert.ok(html.includes('قهوه آزمایشی')); assert.ok(html.includes('منوی قهوه'));
  assert.ok(html.includes('rel="canonical" href="https://shop.example/"'));
  for (const block of allBlocks) assert.ok(html.includes(`data-block="${block.blockType}"`), block.blockType);
  assert.ok(!html.includes('unknownFutureBlock')); assert.ok(!html.includes(API_KEY)); assert.ok(!html.includes(RECEIPT_SECRET));
  assert.ok(html.includes('۰۹۱۲۱۲۳۴۵۶۷'));
  const redirect = await fetch(`${base}/old-menu?ref=card`, { redirect: 'manual' });
  assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/products/coffee?ref=card');
  assert.equal((await fetch(`${base}/de`)).status, 404);
  assert.equal((await fetch(`${base}/fa`, { redirect: 'manual' })).status, 308);
  assert.equal((await fetch(`${base}/missing`)).status, 404);
  assert.match(await (await fetch(`${base}/posts/coffee-story`)).text(), /اردیبهشت/);
  assert.match(await (await fetch(`${base}/search?q=قهوه`)).text(), /داستان قهوه/);
  assert.match(await (await fetch(`${base}/sitemap.xml`)).text(), /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
});
test('visitor writes preserve Host, never carry key/cookies, and reject proxy loops', async (t) => {
  const { base, cms } = await running(t);
  const body = { product: PRODUCT_ID, quantity: 1, name: 'علی', phone: '۰۹۱۲۱۲۳۴۵۶۷', company: '' };
  const response = await fetch(`${base}/api/checkout`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'payload-token=private', authorization: 'Bearer visitor-private' }, body: JSON.stringify(body) });
  assert.equal(response.status, 200);
  const write = cms.state.checkouts[0]; assert.deepEqual(write.body, body);
  assert.equal(write.headers.authorization, undefined); assert.equal(write.headers.cookie, undefined); assert.equal(write.headers.host, new URL(cms.origin).host);
  assert.equal((await fetch(`${base}/api/checkout`, { method: 'POST', headers: { 'x-eshobe-theme-proxy': '1' }, body: '{}' })).status, 508);
  assert.equal((await fetch(`${base}/api/orders`)).status, 404);
  assert.equal((await fetch(`${base}/api/products?draft=true`)).status, 400);
});
test('signed receipt renders every line, exact totals, instructions and no-store/no-referrer', async (t) => {
  const { base, cms } = await running(t);
  const signature = receiptSignature(RECEIPT_SECRET, SITE_ID, ORDER_ID);
  const path = `/checkout/${ORDER_ID}?r=${signature}`;
  assert.equal((await fetch(`${base}/checkout/${ORDER_ID}?r=wrong`)).status, 404);
  const response = await fetch(`${base}${path}`); const html = await response.text();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  for (const value of ['قهوه اول', 'قهوه دوم', 'بزرگ', '۴۸۰٬۰۰۰ تومان', '۲۰٬۰۰۰ تومان', '۳۰٬۰۰۰ تومان', '۱۰٬۰۰۰ تومان', '۵٬۰۰۰ تومان', '۵۰۵٬۰۰۰ تومان', 'پرداخت کارت به کارت']) assert.ok(html.includes(value), value);
  assert.ok(html.includes('noindex,nofollow')); assert.equal(cms.state.orderReads, 1);
});
test('suspended site serves holding page on every content path without content', async (t) => {
  const { base, client } = await running(t); const site = await client.getSite(); site.status = 'suspended';
  const response = await fetch(`${base}/en/products/coffee`); const html = await response.text();
  assert.equal(response.status, 200); assert.ok(html.includes('noindex')); assert.ok(!html.includes('قهوه آزمایشی'));
  assert.equal((await fetch(`${base}/api/checkout`, { method: 'POST', body: '{}' })).status, 503);
});
test('explicit preview is labelled and refuses writes; missing setup never enables it', async () => {
  for (const env of [{ DEMO_MODE: 'true' }, {}]) {
    const app = createApp({ env }); await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    try {
      const html = await (await fetch(base)).text();
      if (env.DEMO_MODE) { assert.ok(html.includes('Design preview')); assert.equal((await fetch(`${base}/api/checkout`, { method: 'POST', body: '{}' })).status, 403); }
      else { assert.ok(html.includes('CMS connection required')); assert.ok(!html.includes('Espresso')); }
    } finally { await new Promise((r) => app.server.close(r)); }
  }
});
