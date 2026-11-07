import { escapeHtml as e } from './security.js';
import { pathFor } from './routing.js';

export function navigationView(ctx, items) {
  const { site, locale, t } = ctx;
  const ids = new Set(items.map((i) => i.id));
  const renderItems = (parent = null, seen = new Set()) => items.filter((i) => (ids.has(i.parent) ? i.parent : null) === parent).map((i) => {
    if (seen.has(i.id)) return '';
    const next = new Set(seen).add(i.id);
    const children = items.some((child) => child.parent === i.id) ? `<ul>${renderItems(i.id, next)}</ul>` : '';
    return `<li><a href="${e(i.url)}"${i.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''}>${e(i.label)}</a>${children}</li>`;
  }).join('');
  const languages = site.availableLocales.filter((l) => l !== locale).map((l) => `<a href="${e(pathFor(site, l))}" hreflang="${e(l)}" lang="${e(l)}">${l === 'fa' ? 'فارسی' : 'English'}</a>`).join('');
  if (!items.length && !languages) return '';
  return `<nav class="site-nav" aria-label="${e(t.menuLabel)}"><a class="site-nav__home" href="${e(pathFor(site, locale))}">${e(site.branding?.shortName || site.branding?.displayName || site.name)}</a><ul>${renderItems()}</ul><div class="site-nav__tools">${languages}<form action="${e(pathFor(site, locale, '/search'))}" method="get" role="search"><input type="search" name="q" placeholder="${e(t.searchPlaceholder)}" aria-label="${e(t.search)}" maxlength="120"><button type="submit" aria-label="${e(t.search)}">⌕</button></form></div></nav>`;
}
