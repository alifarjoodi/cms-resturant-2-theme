import { readFile } from 'node:fs/promises';
import { themeCss, dirFor, formatNumber, formatDate } from '@eshobe/site-runtime';
import { escapeHtml as e, jsonScript } from './security.js';
import { imageHtml, mediaUrl } from './media.js';
import { lexical } from './lexical.js';
import { productViewModel } from './products.js';
import { documentPath, pathFor, publicOrigin } from './routing.js';
import { renderBlock } from './blocks.js';
import { renderReceipt } from './receipt.js';

const template = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../eshobe.theme.json', import.meta.url), 'utf8'));
const icon = (path) => `<svg class="item__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
const heart = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
const bag = 'M18 6h-2c0-2.76-2.24-5-5-5S6 3.24 6 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3z';
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function settingsFor(site) {
  const result = {};
  for (const [key, schema] of Object.entries(manifest.settings)) result[key] = site.themeRuntime?.settings?.[key] ?? schema.default;
  return result;
}
export function cupHtml(artwork) {
  const overlay = artwork === 'cappuccino' ? '<span class="foam"></span>' : artwork === 'latte' ? '<span class="heart"></span>' : artwork === 'mocha' ? '<span class="swirl"></span>' : '';
  return `<div class="cup cup--${e(artwork)}" aria-hidden="true"><span class="saucer"></span><span class="mug"><span class="coffee">${overlay}</span></span></div>`;
}

export function shell(ctx, content, { title, description = '', bodyClass = '', noindex = false, canonical, doc, jsonLd } = {}) {
  const { site, locale, config, requestOrigin } = ctx;
  const origin = publicOrigin(config, site, requestOrigin);
  const name = site.branding?.displayName || site.name;
  const pageTitle = title ? `${title} — ${name}` : name;
  const url = canonical ?? `${origin}${ctx.path === '/' ? '' : ctx.path}`;
  const og = mediaUrl(doc?.meta?.image || site.branding?.socialImage || site.branding?.defaultOgImage, site, 'og');
  const favicon = mediaUrl(site.branding?.favicon, site, 'thumbnail');
  const alternates = (ctx.alternates ?? []).map((a) => `<link rel="alternate" hreflang="${e(a.locale)}" href="${e(origin + a.path)}">`).join('');
  const head = `<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="${e(/^#[0-9a-f]{3,6}$/i.test(site.theme?.background || '') ? site.theme.background : '#fff8e8')}">
    <title>${e(pageTitle)}</title><meta name="description" content="${e(description)}">
    ${noindex ? '<meta name="robots" content="noindex,nofollow">' : `<link rel="canonical" href="${e(url)}">${alternates}`}
    <meta property="og:title" content="${e(pageTitle)}"><meta property="og:description" content="${e(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${e(url)}">
    ${og && !noindex ? `<meta property="og:image" content="${e(new URL(og, origin).href)}"><meta name="twitter:card" content="summary_large_image">` : ''}
    ${favicon ? `<link rel="icon" href="${e(favicon)}">` : ''}
    <link rel="preload" href="/public/fonts/vazirmatn-${locale === 'fa' ? 'arabic' : 'latin'}-400-normal.woff" as="font" type="font/woff" crossorigin>
    <link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/cms.css">
    <style>${themeCss(site.theme)}</style><script src="/app.js" defer></script>
    ${jsonLd ? `<script type="application/ld+json">${jsonScript(jsonLd)}</script>` : ''}`;
  return template.replace('{{HEAD}}', head).replace('{{LANG}}', e(locale)).replace('{{DIR}}', dirFor(locale)).replace('{{BODY_CLASS}}', e(bodyClass)).replace('{{CONTENT}}', content);
}

export async function renderHome(ctx, page) {
  const { site, locale, client, t } = ctx;
  const settings = ctx.settings;
  const blocks = page?.layout ?? [];
  const grid = blocks.find((b) => b.blockType === 'productGrid' && site.blocks.includes('productGrid'));
  let products = [];
  if (grid) products = await client.productsForBlock(grid, site, locale, settings);
  else if (site.type === 'store' && !page) products = (await client.list('products', { locale, limit: settings.menuLimit, sort: '-createdAt' })).docs;
  const showBuyButton = grid?.showBuyButton !== false;
  const views = products.map((p, i) => productViewModel(p, site, locale, i, { showBuyButton }));
  ctx.productViews = views;
  const brandName = site.branding?.displayName || site.name;
  const words = brandName.trim().split(/\s+/);
  const logo = site.branding?.homeLogo || site.branding?.primaryLogo || site.branding?.logo;
  const brandMarkup = logo ? imageHtml(logo, site, brandName, { className: 'brand__logo', eager: true }) : `<span>${e(words[0] || '')}</span>${words.length > 1 ? `<span class="brand__name-second">${e(words.slice(1).join(' '))}</span>` : ''}`;
  const tagline = site.branding?.tagline || settings.tagline;
  const heroText = page?.hero?.richText ? plainText(page.hero.richText) : '';
  const description = settings.brandDescription || heroText;
  const slogan = String(settings.slogan || '').split('\n').slice(0, 4);
  const menuTitle = grid?.heading || settings.menuTitle;
  const cards = views.map((p, index) => renderCard(p, index, ctx, showBuyButton)).join('');
  const home = `<div class="site-frame">${ctx.demoBanner}${ctx.navigationHtml}
    <main class="poster${views.length !== 8 ? ' poster--flexible' : ''}" aria-label="${e(brandName)}" data-menu-count="${views.length}">
      <section class="menu" aria-labelledby="menu-title"><h1 id="menu-title">${e(menuTitle)}</h1>
        ${grid?.intro ? `<p class="menu-intro">${e(grid.intro)}</p>` : ''}
        <div class="menu-grid">${cards || `<p class="empty-menu">${e(t.emptyMenu)}</p>`}</div>
      </section>
      <aside class="brand" aria-label="${e(brandName)}"><header class="brand__head"><p class="brand__name${logo ? ' brand__name--logo' : ''}">${brandMarkup}</p>${tagline ? `<p class="brand__tag">${e(tagline)}</p>` : ''}</header>
        <div class="hero-cup" aria-hidden="true"><span class="hero-cup__saucer"></span><span class="hero-cup__mug"><span class="hero-cup__coffee"></span></span></div>
      </aside>
      <footer class="brand__foot">${description ? `<p class="brand__desc">${e(description)}</p>` : ''}<p class="brand__slogan">${slogan.map((line, i) => `<span class="${i % 2 ? 'slogan-small' : 'slogan-large'}">${e(line)}</span>`).join('')}</p></footer>
    </main>${await renderExtraBlocks(ctx, blocks, grid)}${ctx.footerHtml}</div>${detailHtml(ctx)}${checkoutHtml(ctx, views)}
    <script type="application/json" id="theme-data">${jsonScript({ locale, defaultLocale: site.defaultLocale, siteKey: site.id || site.slug, demo: ctx.demo, currency: site.store.currency, products: ctx.productViews, paymentMethods: site.paymentMethods || [], strings: t })}</script>
    <p class="sr-only" id="action-status" role="status" aria-live="polite"></p>`;
  return shell(ctx, home, { title: '', description: page?.meta?.description || description, doc: page, canonical: `${publicOrigin(ctx.config, site, ctx.requestOrigin)}${pathFor(site, locale)}` });
}

export function renderCard(p, index, ctx, showBuyButton = true) {
  const { t, settings } = ctx;
  const art = p.image ? imageHtml({ url: p.image, alt: p.title }, ctx.site, p.title, { className: 'item__photo', eager: index < 2 }) : cupHtml(p.artwork);
  return `<div class="cell" data-product-index="${index}">
    <a class="item" href="${e(p.href)}" aria-haspopup="dialog" aria-controls="item-detail" aria-label="${e(`${t.details}: ${p.title}, ${p.price}`)}" data-index="${index}">
      ${art}<h2>${e(p.title)}</h2><p>${e(p.summary)}</p><span class="price">${e(p.price)}</span>${p.compareAt ? `<s class="compare-price">${e(p.compareAt)}</s>` : ''}${p.stock === 0 ? `<span class="stock-label">${e(t.soldOut)}</span>` : ''}
    </a>
    <div class="item__actions">${settings.showFavorites ? `<button class="item__action item__action--fav" type="button" data-action="favorite" data-index="${index}" aria-pressed="false" aria-label="${e(`${t.favorite}: ${p.title}`)}">${icon(heart)}</button>` : ''}
    ${p.canBuy && !ctx.demo ? `<button class="item__action item__action--cart" type="button" data-action="cart" data-index="${index}" aria-label="${e(`${t.order}: ${p.title}`)}">${icon(bag)}</button>` : p.externalUrl ? `<a class="item__action item__action--cart" href="${e(p.externalUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${e(p.buttonText || t.external)}">${icon(bag)}</a>` : ''}</div>
  </div>`;
}

export async function renderExtraBlocks(ctx, blocks, consumedGrid) {
  let output = '';
  for (const block of blocks) {
    if (block === consumedGrid) continue;
    output += await renderBlock(block, { ...ctx, renderProductGrid: (products, options) => `<div class="menu-grid cms-product-grid">${products.map((p, i) => { const view = productViewModel(p, ctx.site, ctx.locale, i, options); const index = ctx.productViews.length; ctx.productViews.push(view); return renderCard(view, index, ctx, options.showBuyButton); }).join('')}</div>`, renderArticles: (docs) => articleGrid(docs, ctx) });
  }
  return output ? `<div class="extra-blocks">${output}</div>` : '';
}

export function detailHtml(ctx) {
  const t = ctx.t;
  const name = ctx.site.branding?.displayName || ctx.site.name;
  return `<dialog class="detail" id="item-detail" aria-labelledby="detail-name" aria-describedby="detail-desc"><div class="detail__glass"><span class="detail__scan" aria-hidden="true"></span>
    <div class="detail__topbar"><p class="detail__brand">${e(name)}</p><button class="detail__close" type="button" aria-label="${e(t.close)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>
    <div class="detail__body"><div class="detail__info"><p class="detail__kicker">${e(t.aboutCup)}</p><div class="detail__desc rich-text" id="detail-desc"></div><ul class="detail__notes"></ul>
      <div class="detail__stats"><div class="detail__stat" data-stat="intensity"><span class="detail__stat-label">${e(t.intensity)}</span><span class="detail__dots"></span></div><div class="detail__stat" data-stat="volume"><span class="detail__stat-label">${e(t.volume)}</span><span class="detail__stat-value" data-field="volume"></span></div><div class="detail__stat" data-stat="temp"><span class="detail__stat-label">${e(t.served)}</span><span class="detail__stat-value" data-field="temp"></span></div></div>
      <div class="detail__variation" hidden><label for="detail-variation">${e(t.variation)}</label><select id="detail-variation"></select></div>
      <div class="detail__purchase"><p class="detail__price"><span class="detail__price-amount"></span><s class="detail__compare" hidden></s><span class="detail__price-note">${e(t.perCup)}</span></p><button class="detail__cta" type="button"><span>${e(t.order)}</span>${arrow}</button></div>
      <a class="detail__permalink" href="#">${e(t.viewProduct)}</a><p class="detail__stock" role="status"></p><p class="sr-only" role="status" aria-live="polite"></p>
    </div><div class="detail__art"><span class="detail__ghost" aria-hidden="true"></span><span class="detail__glow" aria-hidden="true"></span><div class="detail__stage" aria-hidden="true"></div><div class="detail__identity"><p class="detail__eyebrow"><span class="detail__num"></span><span class="detail__cat"></span></p><h2 class="detail__name" id="detail-name"></h2></div></div></div>
  </div></dialog>`;
}

export function checkoutHtml(ctx, products) {
  const t = ctx.t;
  const field = (name, label, type = 'text', extra = '') => `<label class="checkout-field">${e(label)}<input name="${name}" type="${type}" ${extra}></label>`;
  return `<dialog class="checkout" id="checkout-dialog" aria-labelledby="checkout-title"><div class="checkout__panel"><button type="button" class="checkout__close" aria-label="${e(t.close)}">×</button><p class="checkout__eyebrow">${e(ctx.site.branding?.displayName || ctx.site.name)}</p><h2 id="checkout-title">${e(t.checkoutTitle)}</h2>
    <div class="checkout__summary"><span id="checkout-product"></span><strong id="checkout-price"></strong></div>
    ${ctx.demo ? `<p class="notice">${e(t.demoCheckout)}</p>` : ''}
    <form id="checkout-form"><div class="honeypot" aria-hidden="true"><label>Company<input name="company" tabindex="-1" autocomplete="off"></label></div>
      <label class="checkout-field" id="checkout-variation-field" hidden>${e(t.variation)}<select name="variation" id="checkout-variation"></select></label>
      <div class="checkout-fields">${field('name', t.name, 'text', 'required maxlength="200" autocomplete="name"')}${field('phone', t.phone, 'tel', 'required inputmode="tel" autocomplete="tel" dir="ltr" placeholder="09121234567"')}${field('quantity', t.quantity, 'number', 'required min="1" max="99" value="1" inputmode="numeric"')}${field('email', t.email, 'email', 'autocomplete="email" dir="ltr" maxlength="254"')}</div>
      ${field('couponCode', t.coupon, 'text', 'maxlength="80" autocomplete="off"')}
      <label class="checkout-field">${e(t.note)}<textarea name="note" rows="2" maxlength="500"></textarea></label>
      <fieldset class="checkout-methods" hidden><legend>${e(t.payment)}</legend><div id="payment-methods"></div></fieldset>
      <p class="checkout__secure">${e(t.secure)}</p><p id="checkout-error" role="alert" hidden></p>
      <button class="checkout__submit" type="submit"${ctx.demo ? ' disabled' : ''}>${e(ctx.demo ? t.demoCheckout : t.submit)}</button>
    </form></div></dialog>`;
}

export function articleGrid(docs, ctx) {
  return `<div class="cms-grid article-grid" data-columns="3">${docs.map((doc) => `<article class="cms-card article-card">${doc.heroImage ? `<a href="${e(documentPath(ctx.site, ctx.locale, doc, '/posts'))}">${imageHtml(doc.heroImage, ctx.site, doc.title)}</a>` : ''}<div class="article-card__body">${doc.publishedAt ? `<time datetime="${e(doc.publishedAt)}">${e(formatDate(doc.publishedAt, ctx.locale))}</time>` : ''}<h2><a href="${e(documentPath(ctx.site, ctx.locale, doc, '/posts'))}">${e(doc.title)}</a></h2><p>${e(doc.meta?.description || '')}</p><a class="text-link" href="${e(documentPath(ctx.site, ctx.locale, doc, '/posts'))}">${e(ctx.t.readMore)} ↗</a></div></article>`).join('')}</div>`;
}

export async function renderContent(ctx, { heading, body = '', docs = [], page, extra = '', pagination, noindex = false }) {
  const content = `<div class="site-frame">${ctx.demoBanner}${ctx.navigationHtml}<main class="content-page"><header class="content-page__head"><p class="eyebrow">${e(ctx.site.branding?.displayName || ctx.site.name)}</p><h1>${e(heading)}</h1>${page?.meta?.description ? `<p>${e(page.meta.description)}</p>` : ''}</header>${page?.hero?.richText ? lexical(page.hero.richText, ctx) : ''}${body}${docs.length ? articleGrid(docs, ctx) : ''}${extra}${pagination || ''}</main>${ctx.footerHtml}</div>${detailHtml(ctx)}${checkoutHtml(ctx, [])}<script type="application/json" id="theme-data">${jsonScript({ locale: ctx.locale, defaultLocale: ctx.site.defaultLocale, siteKey: ctx.site.id || ctx.site.slug, demo: ctx.demo, products: ctx.productViews || [], strings: ctx.t, paymentMethods: [] })}</script><p class="sr-only" id="action-status" role="status" aria-live="polite"></p>`;
  return shell(ctx, content, { title: heading, description: page?.meta?.description || '', doc: page, noindex });
}

export async function renderBlocksPage(ctx, page) {
  const body = await renderExtraBlocks(ctx, page.layout ?? [], null);
  return renderContent(ctx, { heading: page.title, page, body, noindex: page.noindex });
}

export function renderError(ctx, status, message) {
  const content = `<main class="status-page"><p class="eyebrow">${e(ctx.site?.branding?.displayName || 'Coffee Poster')}</p><h1>${e(message)}</h1><a class="cms-button" href="/">${e(ctx.t?.backHome || 'Back to home')}</a></main>`;
  if (!ctx.site) return template.replace('{{HEAD}}', `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${e(message)}</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/cms.css">`).replace('{{LANG}}', 'fa').replace('{{DIR}}', 'rtl').replace('{{BODY_CLASS}}', '').replace('{{CONTENT}}', content);
  return shell(ctx, content, { title: message, noindex: true });
}
export { renderReceipt };
