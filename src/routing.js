import { HOME_SLUG, POSTS_SEGMENT, PRODUCTS_SEGMENT, SEARCH_SEGMENT, CHECKOUT_SEGMENT, localeHref, pagePath } from '@eshobe/site-runtime';

const KNOWN_LOCALES = new Set(['fa', 'en']);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// The published v1 resolver is in the CMS's src/lib/site-route.ts, not in the
// published runtime package. Keep this small adapter aligned with that contract.
export function resolveSiteRoute(path = []) {
  const segments = (KNOWN_LOCALES.has(path[0]) ? path.slice(1) : path).map(decodeURIComponent);
  const [first, second] = segments;
  if (!first) return { kind: 'page', slug: HOME_SLUG };
  if (first === POSTS_SEGMENT) return second ? { kind: 'post', slug: second } : { kind: 'posts' };
  if (first === SEARCH_SEGMENT && segments.length === 1) return { kind: 'search' };
  if (first === PRODUCTS_SEGMENT) return second ? { kind: 'product', slug: second } : { kind: 'catalogue' };
  if (first === CHECKOUT_SEGMENT && segments.length <= 2) return { kind: 'checkout', order: second ?? null };
  return { kind: 'page', slug: segments.join('/') };
}

export function localeFor(site, path = []) {
  if (KNOWN_LOCALES.has(path[0]) && !site.availableLocales.includes(path[0])) return null;
  return KNOWN_LOCALES.has(path[0]) ? path[0] : site.defaultLocale;
}

export function pathFor(site, locale, path = '/') {
  return localeHref(path, locale, site.defaultLocale);
}

export function documentPath(site, locale, doc, base = '') {
  return pathFor(site, locale, base ? `${base}/${doc.slug}` : pagePath(doc.slug));
}

export function normalizePath(path) {
  const segments = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

export function publicOrigin(config, site, requestOrigin = '') {
  if (config.publicOrigin) return config.publicOrigin;
  if (config.demo && requestOrigin) return new URL(requestOrigin).origin;
  return `https://${site.domain}`;
}

export function safeUrl(value, { relative = true } = {}) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  if (/[\u0000-\u0020\u007f]/.test(text)) return null;
  if (relative && text.startsWith('/') && !text.startsWith('//')) return text;
  try {
    const url = new URL(text);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function relationId(value) {
  return value && typeof value === 'object' ? value.id : value;
}

export function linkUrl(link, site, locale) {
  if (!link) return null;
  if (link.type === 'custom') return safeUrl(link.url);
  const ref = link.reference ?? link.doc;
  const doc = typeof ref?.value === 'object' ? ref.value : ref;
  if (!doc || typeof doc !== 'object' || !doc.slug || doc._status === 'draft') return null;
  const collection = ref?.relationTo ?? link.relationTo ?? doc.relationTo;
  const base = collection === 'posts' ? '/posts' : collection === 'products' ? '/products' : '';
  return documentPath(site, locale, doc, base);
}
