import { formatPrice, formatNumber, toLocaleDigits } from '@eshobe/site-runtime';
import { plainText } from './lexical.js';
import { mediaUrl } from './media.js';
import { relationId, safeUrl, documentPath } from './routing.js';
import { activeModifierGroups, categoryOf, menuState, needsCart } from './menu.js';

export const MAX_QUANTITY = 99;
export const ARTWORKS = new Set(['espresso', 'double', 'americano', 'cappuccino', 'latte', 'mocha', 'macchiato', 'flatwhite']);
export function activeVariations(product) {
  return (product.variations ?? []).filter((v) => v.active !== false && Number.isSafeInteger(v.price) && v.price >= 0);
}
export function availability(product, variation) {
  const row = variation?.trackInventory ? variation : product;
  return row.trackInventory && Number.isFinite(row.inventory) ? Math.max(0, row.inventory) : null;
}
export function priceLabel(product, site, locale, variation) {
  const currency = site.store.currency;
  if (product.productType === 'variable' && !variation) {
    const prices = activeVariations(product).map((v) => v.price);
    if (!prices.length) return '';
    const min = Math.min(...prices), max = Math.max(...prices);
    return min === max ? formatPrice(min, currency, locale) : `${formatPrice(min, currency, locale)} – ${formatPrice(max, currency, locale)}`;
  }
  return formatPrice(variation?.price ?? product.price, currency, locale);
}
/** `+۲۰٬۰۰۰ تومان` / `−۵٬۰۰۰ تومان`; a zero delta is just `بدون هزینه`. */
export function deltaLabel(delta, site, locale) {
  const currency = site.store.currency;
  if (!Number.isSafeInteger(delta) || delta === 0) return '';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${formatPrice(Math.abs(delta), currency, locale)}`;
}
export function productViewModel(product, site, locale, index, { showBuyButton = true } = {}) {
  const type = product.productType || 'simple';
  const state = menuState(product);
  const variations = activeVariations(product).map((v) => ({
    key: String(v.key ?? ''), label: v.label || String(v.key ?? ''),
    price: priceLabel(product, site, locale, v), image: mediaUrl(v.image, site, 'large'),
    available: availability(product, v),
  })).filter((v) => v.key);
  const selected = variations.find((v) => v.available === null || v.available > 0) ?? variations[0];
  // A POS "sold out"/"unavailable" outranks a stale stock figure: the CMS's own
  // checkout refuses the line, so the card must not pretend otherwise.
  const stock = state === 'available' ? (type === 'variable' ? selected?.available : availability(product)) : 0;
  const externalUrl = type === 'external' ? safeUrl(product.externalUrl, { relative: false }) : null;
  const category = categoryOf(product);
  const notes = (product.attributes ?? []).filter((a) => a.visible !== false && !a.usedForVariation).flatMap((a) => (a.options ?? []).map((o) => o.value)).filter(Boolean).slice(0, 5);
  const preview = product.preview ?? {};
  const rawModifiers = activeModifierGroups(product);
  const modifiers = rawModifiers.map((group) => ({
    ...group,
    options: group.options.map((option) => ({ ...option, priceLabel: deltaLabel(option.priceDelta, site, locale) })),
  }));
  const priceMinor = Number.isSafeInteger(product.price) ? product.price : 0;
  return {
    id: product.id, title: product.title, slug: product.slug,
    href: documentPath(site, locale, product, '/products'),
    num: formatNumber(index + 1, locale, { minimumIntegerDigits: 2 }),
    category: preview.category || category.name,
    summary: product.summary || '', description: preview.description || plainText(product.body) || product.summary || '',
    price: priceLabel(product, site, locale), compareAt: product.compareAtPrice > (product.price ?? 0) ? formatPrice(product.compareAtPrice, site.store.currency, locale) : '',
    priceMinor,
    compareAtMinor: Number.isSafeInteger(product.compareAtPrice) ? product.compareAtPrice : 0,
    image: mediaUrl(product.image, site, 'medium'), largeImage: mediaUrl(product.image, site, 'large'),
    type, variations, selectedVariation: selected?.key || '', stock,
    state,
    canBuy: showBuyButton && ['simple', 'variable'].includes(type) && (type !== 'variable' || variations.length > 0) && stock !== 0 && state === 'available',
    externalUrl, buttonText: product.buttonText || '',
    grouped: (product.groupedProducts ?? []).filter((p) => typeof p === 'object' && p._status !== 'draft').map((p) => ({ title: p.title, href: documentPath(site, locale, p, '/products') })),
    notes: preview.notes ? preview.notes.split('|') : notes,
    intensity: preview.intensity ?? null, volume: preview.volume ? toLocaleDigits(preview.volume, locale) : '',
    temperature: preview.temperature ? toLocaleDigits(preview.temperature, locale) : '',
    artwork: ARTWORKS.has(preview.artwork) ? preview.artwork : [...ARTWORKS][index % 8],
    modifiers,
    usesCart: needsCart(product),
  };
}
export { relationId };
