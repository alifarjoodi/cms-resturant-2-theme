import { ContentCache } from './cache.js';
import { isCurrencyCode } from '@eshobe/site-runtime';
import { relationId, safeUrl, documentPath } from './routing.js';

export class CmsError extends Error {
  constructor(message, status = 503) { super(message); this.name = 'CmsError'; this.status = status; }
}

export function queryString(query = {}) {
  const params = new URLSearchParams();
  const add = (key, value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) params.append(key, value.join(','));
    else if (typeof value === 'object') for (const [k, v] of Object.entries(value)) add(`${key}[${k}]`, v);
    else params.append(key, String(value));
  };
  for (const [key, value] of Object.entries(query)) add(key, value);
  return params.toString();
}

export class CmsClient {
  constructor(config, fetchImpl = globalThis.fetch) {
    this.config = config;
    this.fetch = fetchImpl;
    this.cache = new ContentCache(config.ttl);
    this.demo = false;
  }
  async request(path) {
    let response;
    try {
      response = await this.fetch(`${this.config.cmsUrl}${path}`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}`, Accept: 'application/json' },
        // Do NOT replace Host with the customer domain: the proxy would route
        // this request back into this container. The site key selects the tenant.
        redirect: 'manual', signal: AbortSignal.timeout(8000),
      });
    } catch { throw new CmsError('The CMS is temporarily unavailable.'); }
    if (!response.ok) throw new CmsError('The CMS could not serve this site.', response.status === 404 ? 404 : 503);
    try { return await response.json(); }
    catch { throw new CmsError('The CMS returned an invalid response.'); }
  }
  async getSite() {
    return this.cache.get('site', async () => {
      const site = await this.request('/api/site');
      if (site.contractVersion !== 1) throw new CmsError('Unsupported CMS contract; this theme implements v1.');
      if (site.id !== this.config.siteId) throw new CmsError('The site key does not match the configured site.');
      if (!Array.isArray(site.availableLocales) || !site.availableLocales.length || !site.availableLocales.includes(site.defaultLocale)) {
        throw new CmsError('The CMS returned invalid locale settings.');
      }
      if (!isCurrencyCode(site.store?.currency)) throw new CmsError('The CMS returned an unsupported currency.');
      if (!site.media?.origin || !site.domain) throw new CmsError('The CMS descriptor is incomplete.');
      site.branding ??= {};
      site.themeRuntime ??= {};
      site.themeRuntime.settings ??= {};
      site.themeRuntime.bindings ??= {};
      site.paymentMethods = site.payments?.methods ?? site.paymentMethods ?? [];
      return site;
    });
  }
  async list(collection, query = {}, { cache = true } = {}) {
    // A site key can read drafts. Every public content query must say published.
    const where = { ...query.where };
    if (['pages', 'posts', 'products', 'content-entries'].includes(collection)) where._status = { equals: 'published' };
    if (collection === 'content-entries') { delete where._status; where.status = { equals: 'published' }; }
    if (collection === 'comments') where.status = { equals: 'approved' };
    const select = query.select && ['pages', 'posts', 'products'].includes(collection) ? { ...query.select, id: true, _status: true } : query.select;
    const full = { depth: 1, limit: 24, pagination: false, ...query, ...(select ? { select } : {}), where };
    const path = `/api/${collection}?${queryString(full)}`;
    const load = async () => {
      const result = await this.request(path);
      if (!Array.isArray(result.docs)) throw new CmsError(`Invalid ${collection} response.`);
      return result;
    };
    return cache ? this.cache.get(path, load) : load();
  }
  async bySlug(collection, slug, locale, extra = {}) {
    const result = await this.list(collection, { where: { slug: { equals: slug } }, locale, fallbackLocale: false, limit: 1, ...extra });
    return result.docs[0] ?? null;
  }
  async byId(collection, id, locale, extra = {}) {
    if (typeof id !== 'string' || !id) return null;
    const result = await this.list(collection, { where: { id: { equals: id } }, locale, fallbackLocale: false, limit: 1, ...extra });
    return result.docs[0] ?? null;
  }
  async getHomePage(site, locale) {
    const binding = site.themeRuntime.bindings.home;
    if (binding?.id) return this.byId('pages', binding.id, locale, { depth: 2 });
    if (binding === null && 'home' in site.themeRuntime.bindings) return null;
    // A slug is only a first-run hint for an UNBOUND slot.
    return this.bySlug('pages', 'home', locale, { depth: 2 });
  }
  async productsForBlock(block, site, locale, settings) {
    const limit = Math.max(1, Math.min(24, Number(block.limit ?? settings.menuLimit ?? 8) || 8));
    if (block.populateBy === 'selection') {
      const ids = (block.products ?? []).map(relationId).filter(Boolean).slice(0, 24);
      if (!ids.length) return [];
      const result = await this.list('products', { where: { id: { in: ids } }, locale, limit: ids.length });
      return ids.map((id) => result.docs.find((p) => String(p.id) === String(id))).filter(Boolean);
    }
    return (await this.list('products', { locale, limit, sort: '-createdAt' })).docs;
  }
  async getRedirect(path, site, locale) {
    const result = await this.list('redirects', { where: { from: { equals: path } }, limit: 1, depth: 1, locale });
    const row = result.docs[0];
    if (!row) return null;
    const target = row.to;
    let url = target?.type === 'custom' ? safeUrl(target.url) : linkFromReference(target?.reference, site, locale);
    if (!url || url === path) return null;
    return url;
  }
  async getNavigation(site, locale) {
    const descriptor = (site.menus?.items ?? []).find((m) => m.slug === 'primary' && m.locations?.includes('header'))
      ?? (site.menus?.items ?? []).find((m) => m.location === 'header' || m.locations?.includes('header'));
    let items = [];
    if (descriptor) {
      const result = await this.list('menus', { where: { id: { equals: descriptor.id }, isActive: { equals: true } }, locale, limit: 1 });
      const menu = result.docs[0];
      if (menu?.isActive) {
        items = (menu.items ?? []).filter((i) => i.status === 'published').sort((a, b) => (a.menuOrder ?? 0) - (b.menuOrder ?? 0)).map((item) => {
          const ref = item.reference;
          const doc = typeof ref?.value === 'object' ? ref.value : null;
          const url = item.url ? safeUrl(item.url) : linkFromReference(ref, site, locale);
          return url ? { id: item.key, label: item.label || doc?.title || doc?.name, url, parent: item.parentKey || null, newTab: item.newTab } : null;
        }).filter(Boolean);
      }
    }
    if (!items.length) {
      const result = await this.list('header', { locale, limit: 1 });
      items = (result.docs[0]?.navItems ?? []).map((row, i) => ({ id: String(i), label: row.link?.label, url: navigationLink(row.link, site, locale), parent: null, newTab: row.link?.newTab })).filter((i) => i.url && i.label);
    }
    const footer = await this.list('footer', { locale, limit: 1 });
    const footerItems = (footer.docs[0]?.navItems ?? []).map((row, i) => ({ id: String(i), label: row.link?.label, url: navigationLink(row.link, site, locale), newTab: row.link?.newTab })).filter((i) => i.url && i.label);
    return { header: items, footer: footerItems };
  }
  invalidate() { this.cache.invalidate(); }
}

function linkFromReference(ref, site, locale) {
  const doc = typeof ref?.value === 'object' ? ref.value : null;
  if (!doc?.slug || doc._status === 'draft' || (doc.site && relationId(doc.site) !== site.id)) return null;
  const base = ref.relationTo === 'posts' ? '/posts' : ref.relationTo === 'products' ? '/products' : '';
  if (!['pages', 'posts', 'products'].includes(ref.relationTo)) return null;
  return documentPath(site, locale, doc, base);
}
function navigationLink(link, site, locale) {
  if (link?.type === 'custom') return safeUrl(link.url);
  return linkFromReference(link?.reference, site, locale);
}
