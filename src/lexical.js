import { escapeHtml as e } from './security.js';
import { safeUrl, documentPath } from './routing.js';
import { mediaUrl, imageHtml } from './media.js';

export function plainText(node) {
  if (!node || typeof node !== 'object') return '';
  if (typeof node.text === 'string') return node.text;
  const root = node.root ?? node;
  const children = root.children ?? [];
  return children.map(plainText).join(['paragraph', 'heading', 'quote', 'listitem'].includes(root.type) ? '\n' : '').trim();
}

// Allowlisted Lexical renderer: editor HTML, styles, scripts and event handlers
// are never passed through. Unknown nodes render their children as plain content.
export function lexical(value, context, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 40) return '';
  const node = value.root ?? value;
  const children = () => (node.children ?? []).map((child) => lexical(child, context, depth + 1)).join('');
  const dir = ['rtl', 'ltr'].includes(node.direction) ? node.direction : context.locale === 'fa' ? 'rtl' : 'ltr';
  const direction = ` dir="${dir}"`;
  switch (node.type) {
    case 'root': return `<div class="rich-text"${direction}>${children()}</div>`;
    case 'text': {
      let text = e(node.text);
      const format = Number(node.format) || 0;
      if (format & 1) text = `<strong>${text}</strong>`;
      if (format & 2) text = `<em>${text}</em>`;
      if (format & 8) text = `<u>${text}</u>`;
      if (format & 16) text = `<s>${text}</s>`;
      if (format & 32) text = `<code>${text}</code>`;
      if (format & 64) text = `<sub>${text}</sub>`;
      if (format & 128) text = `<sup>${text}</sup>`;
      return text;
    }
    case 'paragraph': return `<p${direction}>${children() || '<br>'}</p>`;
    case 'heading': {
      const tag = /^h[1-4]$/.test(node.tag) ? node.tag : 'h2';
      return `<${tag}${direction}>${children()}</${tag}>`;
    }
    case 'quote': return `<blockquote${direction}>${children()}</blockquote>`;
    case 'list': return `<${node.tag === 'ol' ? 'ol' : 'ul'}${direction}>${children()}</${node.tag === 'ol' ? 'ol' : 'ul'}>`;
    case 'listitem': return `<li${direction}>${children()}</li>`;
    case 'linebreak': return '<br>';
    case 'horizontalrule': return '<hr>';
    case 'link':
    case 'autolink': {
      const fields = node.fields ?? node;
      const url = fields.url ?? documentReference(fields.doc ?? fields.reference, context);
      const href = safeUrl(url);
      return href ? `<a href="${e(href)}"${fields.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''}>${children()}</a>` : children();
    }
    case 'upload': {
      const media = node.value ?? node.media;
      return media && typeof media === 'object' ? `<figure>${imageHtml(media, context.site, node.caption || media.alt)}${node.caption ? `<figcaption>${e(node.caption)}</figcaption>` : ''}</figure>` : '';
    }
    case 'block': {
      const block = node.fields ?? {};
      if (block.blockType === 'mediaBlock') return `<figure>${imageHtml(block.media, context.site, block.caption)}</figure>`;
      if (block.blockType === 'mediaGrid') return `<div class="cms-media-grid">${(block.images ?? []).map((media) => imageHtml(media, context.site)).join('')}</div>`;
      if (block.blockType === 'banner') return `<aside class="cms-banner">${lexical(block.content, context, depth + 1)}</aside>`;
      return '';
    }
    default: return children();
  }
}
function documentReference(ref, { site, locale }) {
  const doc = typeof ref?.value === 'object' ? ref.value : ref;
  if (!doc?.slug || doc._status === 'draft') return null;
  return documentPath(site, locale, doc, ref?.relationTo === 'posts' ? '/posts' : '');
}
