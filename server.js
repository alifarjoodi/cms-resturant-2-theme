import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDate, formatNumber } from '@eshobe/site-runtime';
import { readConfig, configurationError } from './src/config.js';
import { CmsClient, CmsError } from './src/cms.js';
import { DemoClient } from './src/demo.js';
import { readBody, verifyRevalidation, escapeHtml as e, jsonScript } from './src/security.js';
import { proxyApi } from './src/proxy.js';
import { resolveSiteRoute, localeFor, normalizePath, documentPath, pathFor, publicOrigin } from './src/routing.js';
import { strings } from './src/ui.js';
import { renderHome, renderContent, renderBlocksPage, renderError, renderReceipt, settingsFor, renderCard, cupHtml, articleGrid } from './src/render.js';
import { lexical } from './src/lexical.js';
import { productViewModel } from './src/products.js';
import { imageHtml } from './src/media.js';
import { navigationView } from './src/navigation.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const staticFiles = new Map([
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/cms.css', ['cms.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);
const mime = { '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8' };

export function createApp({ env = process.env, client: injectedClient, fetchImpl } = {}) {
  const config = readConfig(env);
  const client = injectedClient ?? (config.demo ? new DemoClient() : new CmsClient(config, fetchImpl));
  const demo = client.demo === true;
  const setupError = injectedClient ? '' : configurationError(config);

  async function siteContext(pathname, search, req) {
    const site = await client.getSite();
    const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const locale = localeFor(site, segments);
    return { site, locale, segments, config, client, demo, t: strings(locale || site.defaultLocale), settings: settingsFor(site), path: pathname, search, requestOrigin: `http://${req.headers.host || 'localhost'}` };
  }

  async function decorate(ctx) {
    const navigation = ctx.settings.showNavigation && ctx.site.status === 'active' ? await client.getNavigation(ctx.site, ctx.locale) : { header: [], footer: [] };
    ctx.navigationHtml = navigationView(ctx, navigation.header);
    ctx.footerHtml = navigation.footer.length ? `<footer class="site-footer"><span>${e(ctx.site.branding?.displayName || ctx.site.name)}</span><nav aria-label="${e(ctx.locale === 'fa' ? 'پیوندهای پایین صفحه' : 'Footer navigation')}">${navigation.footer.map((i) => `<a href="${e(i.url)}"${i.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''}>${e(i.label)}</a>`).join('')}</nav></footer>` : '';
    ctx.demoBanner = demo ? `<aside class="demo-banner" role="note">${e(ctx.t.preview)}</aside>` : '';
    return ctx;
  }

  async function alternatesFor(ctx, doc, base = '') {
    if (!doc?.id) return [];
    const alternatives = await Promise.all(ctx.site.availableLocales.map(async (locale) => {
      const translated = locale === ctx.locale ? doc : await client.byId(base === '/posts' ? 'posts' : base === '/products' ? 'products' : 'pages', doc.id, locale);
      return translated?.slug ? { locale, path: documentPath(ctx.site, locale, translated, base) } : null;
    }));
    return alternatives.filter(Boolean);
  }

  async function route(req, res, url) {
    const pathname = normalizePath(url.pathname);
    // Check redirects before locale/content routing. Only one hop, no chaining.
    let ctx;
    try { ctx = await siteContext(pathname, url.searchParams, req); }
    catch (error) {
      const status = error instanceof CmsError && error.status === 404 ? 404 : 503;
      return html(res, status, renderError({ t: strings(config.locale) }, status, status === 404 ? 'This site is not connected.' : 'The store is temporarily unavailable. Please try again later.'), req);
    }
    if (ctx.site.status !== 'active') {
      ctx.locale = ctx.site.defaultLocale; ctx.t = strings(ctx.locale);
      return html(res, 200, renderError(ctx, 200, ctx.t.holding), req, { cache: 'no-store' });
    }
    const redirect = await client.getRedirect(pathname, ctx.site, ctx.locale || ctx.site.defaultLocale);
    if (redirect) {
      const target = new URL(redirect, 'http://theme.internal');
      if (!target.search) target.search = url.search;
      res.writeHead(308, { Location: target.protocol === 'http:' && target.hostname === 'theme.internal' ? `${target.pathname}${target.search}` : redirect + (new URL(redirect, 'http://theme.internal').search ? '' : url.search), 'Cache-Control': 'no-store' });
      return res.end();
    }
    if (!ctx.locale) return html(res, 404, renderError(await decorate({ ...ctx, locale: ctx.site.defaultLocale, t: strings(ctx.site.defaultLocale) }), 404, strings(ctx.site.defaultLocale).notFound), req);
    if (ctx.segments[0] === ctx.site.defaultLocale && ['fa', 'en'].includes(ctx.segments[0])) {
      res.writeHead(308, { Location: pathFor(ctx.site, ctx.locale, `/${ctx.segments.slice(1).join('/')}`) + url.search, 'Cache-Control': 'public, max-age=300' }); return res.end();
    }
    await decorate(ctx);
    const route = resolveSiteRoute(ctx.segments);
    const { locale } = ctx;
    const page_number = Math.max(1, Math.min(10000, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1));
    if (route.kind === 'checkout') {
      if (!ctx.config.receiptSecret) return html(res, 503, await renderContent(ctx, { heading: ctx.t.receipt, body: `<p class="notice">${e(ctx.t.receiptUnavailable)}</p>`, noindex: true }), req, { cache: 'no-store' });
      const receipt = await renderReceipt(ctx, route.order, url.searchParams);
      if (!receipt) return html(res, 404, renderError(ctx, 404, ctx.t.notFound), req, { cache: 'no-store' });
      return html(res, 200, await renderContent(ctx, { heading: receipt.title, body: receipt.body, noindex: true }), req, { cache: 'no-store', referrerPolicy: 'no-referrer' });
    }
    if (route.kind === 'product') {
      if (ctx.site.type !== 'store') return html(res, 404, renderError(ctx, 404, ctx.t.notFound), req);
      const product = await client.bySlug('products', route.slug, ctx.locale);
      if (!product || product.noindex) return html(res, 404, renderError(ctx, 404, ctx.t.notFound), req);
      const p = productViewModel(product, ctx.site, ctx.locale, 0);
      ctx.alternates = await alternatesFor(ctx, product, '/products');
      const body = `<article class="product-page"><div class="product-page__art">${p.image ? imageHtml({ url: p.largeImage || p.image }, ctx.site, p.title, { eager: true, size: 'large' }) : cupHtml(p.artwork)}</div><div class="product-page__info"><p class="eyebrow">${e(p.category)}</p><h2>${e(p.title)}</h2><p class="product-page__price">${e(p.price)}</p>${p.compareAt ? `<s>${e(p.compareAt)}</s>` : ''}<div class="rich-text">${lexical(product.body, ctx)}</div>${product.productType === 'variable' ? `<label class="checkout-field">${e(ctx.t.variation)}<select id="product-page-variation">${p.variations.map((v) => `<option value="${e(v.key)}">${e(v.label)} — ${e(v.price)}</option>`).join('')}</select></label>` : ''}${p.grouped.length ? `<ul>${p.grouped.map((item) => `<li><a href="${e(item.href)}">${e(item.title)}</a></li>`).join('')}</ul>` : ''}${p.externalUrl ? `<a class="cms-button" href="${e(p.externalUrl)}" target="_blank" rel="noopener noreferrer">${e(p.buttonText || ctx.t.external)}</a>` : p.canBuy ? `<button class="cms-button" type="button" data-buy-index="0">${e(ctx.t.order)}</button>` : `<p>${e(ctx.t.soldOut)}</p>`}<a class="text-link" href="${e(p.href)}" hidden>${e(ctx.t.viewProduct)}</a></div></article>`;
      const output = await renderContent(ctx, { heading: p.title, page: { meta: { description: product.metaDescription || product.summary } }, body, noindex: Boolean(product.noindex) });
      const data = jsonScript({ locale: ctx.locale, defaultLocale: ctx.site.defaultLocale, siteKey: ctx.site.id, demo, products: [p], paymentMethods: ctx.site.paymentMethods, strings: ctx.t });
      return html(res, 200, output.replace(/<script type="application\/json" id="theme-data">.*?<\/script>/s, `<script type="application/json" id="theme-data">${data}</script>`), req);
    }
    if (route.kind === 'posts' || route.kind === 'post') {
      if (route.kind === 'post') {
        const post = await client.bySlug('posts', route.slug, ctx.locale);
        if (!post) return html(res, 404, renderError(ctx, 404, ctx.t.notFound), req);
        ctx.alternates = await alternatesFor(ctx, post, '/posts');
        const related = (post.relatedPosts ?? []).filter((p) => typeof p === 'object' && p._status !== 'draft');
        const body = `${post.heroImage ? `<figure class="article-hero">${imageHtml(post.heroImage, ctx.site, post.title, { eager: true, size: 'large' })}</figure>` : ''}${post.publishedAt ? `<time class="article-date" datetime="${e(post.publishedAt)}">${e(formatDate(post.publishedAt, ctx.locale))}</time>` : ''}<article class="article-body">${lexical(post.content, ctx)}</article>${related.length ? `<section class="cms-section"><h2>${e(ctx.t.related)}</h2>${articleGrid(related, ctx)}</section>` : ''}`;
        return html(res, 200, await renderContent(ctx, { heading: post.title, page: post, body }), req);
      }
      const result = await client.list('posts', { locale, limit: 9, page: page_number, pagination: true, sort: '-publishedAt', depth: 1 });
      return html(res, 200, await renderContent(ctx, { heading: ctx.t.posts, docs: result.docs, pagination: paginationHtml(ctx, result, url.searchParams) }), req);
    }
    if (route.kind === 'search') {
      const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
      let docs = [];
      if (q) {
        const found = await client.list('search', { where: { title: { like: q } }, locale, limit: 18, depth: 0 });
        const ids = found.docs.map((row) => typeof row.doc?.value === 'object' ? row.doc.value.id : row.doc?.value).filter(Boolean);
        if (ids.length) docs = (await client.list('posts', { where: { id: { in: ids } }, locale, limit: 18 })).docs;
      }
      const body = `<form class="search-page-form" method="get" role="search"><input type="search" name="q" value="${e(q)}" maxlength="120" placeholder="${e(ctx.t.searchPlaceholder)}" aria-label="${e(ctx.t.search)}"><button class="cms-button" type="submit">${e(ctx.t.search)}</button></form>${q && !docs.length ? `<p class="empty-menu">${e(ctx.t.noResults)}</p>` : ''}`;
      return html(res, 200, await renderContent(ctx, { heading: ctx.t.search, body, docs, noindex: true }), req, { cache: 'no-store' });
    }
    if (route.kind === 'catalogue') {
      if (ctx.site.type !== 'store') return html(res, 404, renderError(ctx, 404, ctx.t.notFound), req);
      const result = await client.list('products', { locale, limit: 12, page: page_number, pagination: true, sort: '-createdAt' });
      const views = result.docs.map((p, i) => productViewModel(p, ctx.site, ctx.locale, i));
      ctx.productViews = views;
      const body = `<div class="menu-grid cms-product-grid">${views.map((p, i) => renderCard(p, i, ctx)).join('')}</div>${!views.length ? `<p>${e(ctx.t.emptyMenu)}</p>` : ''}`;
      const output = await renderContent(ctx, { heading: ctx.t.menu, body, pagination: paginationHtml(ctx, result, url.searchParams) });
      return html(res, 200, injectProducts(output, ctx, views), req);
    }
    const page = route.slug === 'home' ? await client.getHomePage(ctx.site, ctx.locale) : await client.bySlug('pages', route.slug, ctx.locale, { depth: 2 });
    if (page) {
      ctx.alternates = await alternatesFor(ctx, page);
      if (route.slug === 'home' && ctx.site.type === 'store') {
        const output = await renderHome(ctx, page);
        return html(res, 200, output, req);
      }
      return html(res, 200, await renderBlocksPage(ctx, page), req);
    }
    const hasHomeBinding = Object.prototype.hasOwnProperty.call(ctx.site.themeRuntime?.bindings ?? {}, 'home');
    if (route.slug === 'home' && ctx.site.type === 'store' && !hasHomeBinding) return html(res, 200, await renderHome(ctx, null), req);
    return html(res, 404, renderError(ctx, 404, ctx.t.notFound), req);
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Do not set X-Frame-Options: the CMS editor embeds this origin in its preview.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' https:");
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    try {
      const url = new URL(req.url, 'http://theme.internal');
      if (url.pathname === '/api/health') {
        // Cheap and local: never probe the CMS in a container health check.
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        return res.end(JSON.stringify({ ok: true, contractVersion: 1 }));
      }
      if (url.pathname === '/api/revalidate') {
        if (req.method !== 'POST') return json(res, 405, { ok: false });
        const raw = await readBody(req);
        if (!verifyRevalidation(config.revalidateSecret, raw, req.headers['x-eshobe-signature'])) return json(res, 401, { ok: false });
        let notice;
        try { notice = JSON.parse(raw.toString('utf8')); } catch { return json(res, 400, { ok: false }); }
        if (!notice || typeof notice !== 'object' || (notice.siteId && config.siteId && notice.siteId !== config.siteId)) return json(res, 400, { ok: false });
        client.invalidate(); // Synchronous and fast; no CMS work before the 2xx.
        return json(res, 200, { ok: true, revalidated: true });
      }
      if (url.pathname.startsWith('/api/')) {
        let site = null;
        try { site = await client.getSite(); } catch { /* proxy returns a controlled 503 */ }
        if (await proxyApi(req, res, url, config, site)) return;
        return json(res, 404, { ok: false, message: 'Unknown API route.' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { ok: false });
      const pathname = normalizePath(url.pathname);
      if (staticFiles.has(pathname) || pathname.startsWith('/public/fonts/')) {
        const entry = staticFiles.get(pathname);
        const file = path.resolve(root, entry ? entry[0] : `.${pathname}`);
        if (!entry && !file.startsWith(path.join(root, 'public/fonts') + path.sep)) return json(res, 404, { ok: false });
        const info = await stat(file);
        res.writeHead(200, { 'content-type': entry ? entry[1] : mime[path.extname(file)] || 'application/octet-stream', 'content-length': info.size, 'cache-control': 'public, max-age=3600' });
        if (req.method === 'HEAD') return res.end();
        return createReadStream(file).pipe(res);
      }
      if (pathname === '/robots.txt' || pathname === '/sitemap.xml') return seo(res, req, pathname);
      if (setupError) {
        console.error(`CMS setup required: ${setupError}`);
        return html(res, 200, renderError({ t: strings(config.locale) }, 200, 'CMS connection required. Set ESHOBE_CMS_URL, ESHOBE_API_KEY and ESHOBE_SITE_ID, or explicitly enable DEMO_MODE for a design preview.'), req, { cache: 'no-store' });
      }
      return await route(req, res, url);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ERR_INVALID_URL' || error instanceof URIError) return json(res, 404, { ok: false, message: 'Not found.' });
      // Never log request URLs (receipt capabilities), keys or buyer details.
      console.error('Request failed:', error.stack?.split('\n').slice(0, 3).join('\n'));
      if (!res.headersSent) json(res, error.status || 503, { ok: false, message: 'The site is temporarily unavailable.' });
      else res.end();
    }
  });

  async function seo(res, req, pathname) {
    let site;
    try { site = await client.getSite(); } catch { return text(res, 503, 'Unavailable'); }
    const origin = publicOrigin(config, site, `http://${req.headers.host}`);
    if (pathname === '/robots.txt') return text(res, 200, site.status === 'active' ? `User-agent: *\nAllow: /\nDisallow: /checkout/\nDisallow: /search\nSitemap: ${origin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
    if (site.status !== 'active') return text(res, 200, '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', 'application/xml');
    const urls = [];
    for (const locale of site.availableLocales) {
      for (const [collection, base] of [['pages', ''], ['posts', '/posts'], ...(site.type === 'store' ? [['products', '/products']] : [])]) {
        let page = 1, hasNext = true;
        while (hasNext && page <= 100) {
          const result = await client.list(collection, { locale, fallbackLocale: false, limit: 100, page, pagination: true, depth: 0, select: { slug: true, updatedAt: true, noindex: true } });
          for (const doc of result.docs) if (doc.slug && !doc.noindex) urls.push(`<url><loc>${e(new URL(documentPath(site, locale, doc, base), origin).href)}</loc>${doc.updatedAt ? `<lastmod>${e(formatDate(doc.updatedAt, 'en', { calendar: 'iso8601', year: 'numeric', month: '2-digit', day: '2-digit' }))}</lastmod>` : ''}</url>`);
          hasNext = result.hasNextPage; page += 1;
        }
      }
    }
    return text(res, 200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`, 'application/xml');
  }
  return { server, client, config, decorate, siteContext };
}

function injectProducts(output, ctx, products) {
  return output.replace(/<script type="application\/json" id="theme-data">.*?<\/script>/s, `<script type="application/json" id="theme-data">${jsonScript({ locale: ctx.locale, defaultLocale: ctx.site.defaultLocale, siteKey: ctx.site.id, demo: ctx.demo, products, paymentMethods: ctx.site.paymentMethods, strings: ctx.t })}</script>`);
}
function paginationHtml(ctx, result, params) {
  const link = (page, label) => { const q = new URLSearchParams(params); q.set('page', String(page)); return `<a class="cms-button" href="${e(ctx.path)}?${e(q)}">${e(label)}</a>`; };
  return `<nav class="pagination" aria-label="${e(ctx.t.next)}">${result.hasPrevPage ? link(result.prevPage, ctx.t.previous) : ''}<span>${e(formatNumber(result.page || 1, ctx.locale))}</span>${result.hasNextPage ? link(result.nextPage, ctx.t.next) : ''}</nav>`;
}
function json(res, status, value) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); }
function text(res, status, value, type = 'text/plain; charset=utf-8') { res.writeHead(status, { 'content-type': type, 'cache-control': 'public, max-age=60' }); res.end(value); }
function html(res, status, value, req, options = {}) {
  const buffer = Buffer.from(value);
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'content-length': buffer.length, 'cache-control': options.cache || (status === 200 ? 'public, max-age=30, stale-while-revalidate=60' : 'no-store'), ...(options.referrerPolicy ? { 'referrer-policy': options.referrerPolicy } : {}) });
  res.end(req.method === 'HEAD' ? undefined : buffer);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = readConfig();
  const { server } = createApp();
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.listen(config.port, config.host, () => console.log(`Coffee Poster listening on ${config.host}:${config.port}${config.demo ? ' (explicit design preview)' : ''}`));
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
