import { escapeHtml as e } from './security.js';

export function mediaUrl(media, site, size = 'medium') {
  if (!media || typeof media !== 'object') return '';
  const source = media.sizes?.[size]?.url || media.url;
  if (typeof source !== 'string' || !source.startsWith('/api/media/file/') || source.includes('..')) return '';
  try {
    const resolved = new URL(source, site.media.origin);
    // In direct mode the canonical media origin is this theme. Use a relative
    // browser URL so preview never calls localhost or bypasses the CMS proxy.
    if (resolved.origin === new URL(site.media.origin).origin || resolved.hostname === site.domain) return resolved.pathname;
    return resolved.href;
  } catch { return ''; }
}
export function imageHtml(media, site, alt, { className = '', size = 'medium', eager = false } = {}) {
  const url = mediaUrl(media, site, size);
  if (!url) return '';
  const width = media.sizes?.[size]?.width || media.width;
  const height = media.sizes?.[size]?.height || media.height;
  // SVG is always an img, never inline markup, as required by the CMS contract.
  return `<img src="${e(url)}" alt="${e(alt ?? media.alt ?? '')}" class="${e(className)}"${Number(width) > 0 ? ` width="${Number(width)}"` : ''}${Number(height) > 0 ? ` height="${Number(height)}"` : ''} loading="${eager ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer">`;
}
