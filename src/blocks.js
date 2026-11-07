import { escapeHtml as e } from './security.js';
import { formatNumber, formatPrice, toLocaleDigits } from '@eshobe/site-runtime';
import { lexical } from './lexical.js';
import { imageHtml } from './media.js';
import { linkUrl, relationId, documentPath, safeUrl } from './routing.js';
import { strings } from './ui.js';

const intro = (block) => `${block.heading ? `<h2>${e(block.heading)}</h2>` : ''}${block.intro ? `<p class="cms-intro">${e(block.intro)}</p>` : ''}`;
const columns = (block) => ['2', '3', '4'].includes(String(block.columns)) ? String(block.columns) : '3';
const link = (value, ctx, label) => {
  const href = linkUrl(value, ctx.site, ctx.locale);
  return href ? `<a class="cms-button" href="${e(href)}"${value?.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''}>${e(value?.label || label || ctx.t.details)}</a>` : '';
};

export async function renderBlock(block, ctx) {
  if (!block || !ctx.site.blocks?.includes(block.blockType)) {
    if (block?.blockType) console.warn(`Unsupported CMS block: ${block.blockType}`);
    return '';
  }
  const b = block;
  let content = '';
  switch (b.blockType) {
    case 'content':
      content = `<div class="cms-content-columns">${(b.columns ?? []).map((col) => `<div class="cms-column cms-column--${e(col.size || 'full')}">${lexical(col.richText, ctx)}${col.enableLink ? link(col.link, ctx) : ''}</div>`).join('')}</div>`; break;
    case 'mediaBlock':
      content = `<figure class="cms-media cms-media--${e(b.size || 'content')}" data-aspect="${e(b.aspect || 'auto')}">${imageHtml(b.media, ctx.site, b.caption)}${b.caption ? `<figcaption>${e(b.caption)}</figcaption>` : ''}</figure>`; break;
    case 'cta':
      content = `<div class="cms-cta">${lexical(b.richText, ctx)}<div class="cms-actions">${(b.links ?? []).map((row) => link(row.link, ctx)).join('')}</div></div>`; break;
    case 'features':
      content = intro(b) + `<div class="cms-grid" data-columns="${columns(b)}">${(b.items ?? []).map((item) => `<article class="cms-card">${imageHtml(item.icon, ctx.site, '', { size: 'thumbnail', className: 'cms-icon' })}<h3>${e(item.title)}</h3><p>${e(item.description)}</p></article>`).join('')}</div>`; break;
    case 'testimonials':
      content = intro(b) + `<div class="cms-grid" data-columns="${columns(b)}">${(b.items ?? []).map((item) => `<figure class="cms-card cms-quote"><blockquote>${e(item.quote)}</blockquote><figcaption>${imageHtml(item.avatar, ctx.site, item.author, { size: 'thumbnail', className: 'cms-avatar' })}<strong>${e(item.author)}</strong><span>${e(item.role)}</span></figcaption></figure>`).join('')}</div>`; break;
    case 'faq':
      content = intro(b) + `<div class="cms-faq">${(b.items ?? []).map((item) => `<details><summary>${e(item.question)}</summary><p>${e(item.answer)}</p></details>`).join('')}</div>`; break;
    case 'contact':
      content = intro(b) + `<address class="cms-contact">${b.address ? `<p>${e(b.address)}</p>` : ''}${(b.phones ?? []).map((phone) => `<a dir="ltr" href="tel:${e(String(phone).replace(/[^\d+]/g, ''))}">${e(toLocaleDigits(String(phone), ctx.locale))}</a>`).join('')}${b.email ? `<a href="mailto:${e(b.email)}">${e(b.email)}</a>` : ''}${b.hours ? `<p>${e(b.hours)}</p>` : ''}</address>`; break;
    case 'formBlock': content = await renderForm(b, ctx); break;
    case 'productGrid': {
      const products = await ctx.client.productsForBlock(b, ctx.site, ctx.locale, ctx.settings);
      content = intro(b) + ctx.renderProductGrid(products, { showBuyButton: b.showBuyButton !== false }); break;
    }
    case 'gallery':
    case 'logos':
      content = intro(b) + `<div class="cms-grid cms-gallery" data-columns="${columns(b)}">${(b.images ?? b.logos ?? []).map((media) => imageHtml(media, ctx.site, undefined, { size: 'medium' })).join('')}</div>`; break;
    case 'team':
      content = intro(b) + `<div class="cms-grid" data-columns="${columns(b)}">${(b.members ?? []).map((member) => `<article class="cms-card">${imageHtml(member.photo, ctx.site, member.name)}<h3>${e(member.name)}</h3><p class="cms-muted">${e(member.role)}</p><p>${e(member.bio)}</p></article>`).join('')}</div>`; break;
    case 'pricing':
      content = intro(b) + `<div class="cms-grid" data-columns="${columns(b)}">${(b.plans ?? []).map((plan) => `<article class="cms-card${plan.featured ? ' cms-featured' : ''}"><h3>${e(plan.name)}</h3><p class="cms-plan-price">${e(formatNumber(plan.price ?? 0, ctx.locale))} ${e(plan.unit)}</p><p>${e(plan.period)}</p><ul>${(plan.features ?? []).map((feature) => `<li>${e(typeof feature === 'string' ? feature : feature.text ?? feature.label ?? '')}</li>`).join('')}</ul>${plan.enableLink ? link(plan.link, ctx) : ''}</article>`).join('')}</div>`; break;
    case 'archive': {
      let docs;
      if (b.populateBy === 'selection') {
        const ids = (b.selectedDocs ?? []).map((row) => relationId(row.value)).filter(Boolean);
        docs = ids.length ? (await ctx.client.list('posts', { where: { id: { in: ids } }, locale: ctx.locale, limit: ids.length })).docs : [];
      } else {
        const where = b.categories?.length ? { categories: { in: b.categories.map(relationId) } } : {};
        docs = (await ctx.client.list('posts', { where, locale: ctx.locale, limit: Math.min(24, b.limit || 6), sort: '-publishedAt' })).docs;
      }
      content = lexical(b.introContent, ctx) + ctx.renderArticles(docs); break;
    }
  }
  return content ? `<section class="cms-section" data-block="${e(b.blockType)}">${content}</section>` : '';
}

async function renderForm(block, ctx) {
  const form = typeof block.form === 'object' ? block.form : await ctx.client.byId('forms', block.form, ctx.locale);
  if (!form) return '';
  const fields = (form.fields ?? []).map((field, index) => {
    // Payload form-builder uses blockType, not fieldType.
    const type = field.blockType || field.fieldType;
    if (type === 'message') return `<div class="rich-text">${lexical(field.message, ctx)}</div>`;
    if (['country', 'state', 'upload', 'payment'].includes(type)) return '';
    const id = `form-${e(form.id)}-${index}`;
    const name = e(field.name || `field-${index}`);
    const required = field.required ? ' required' : '';
    const label = e(field.label || field.name || '');
    const placeholder = field.placeholder ? ` placeholder="${e(field.placeholder)}"` : '';
    const value = field.defaultValue != null ? ` value="${e(field.defaultValue)}"` : '';
    let input;
    if (type === 'textarea') input = `<textarea id="${id}" name="${name}" rows="4"${required}${placeholder}>${e(field.defaultValue)}</textarea>`;
    else if (['select', 'radio'].includes(type)) {
      const options = (field.options ?? []).map((o) => ({ value: typeof o === 'string' ? o : o.value, label: typeof o === 'string' ? o : o.label || o.value }));
      input = type === 'radio' ? `<fieldset id="${id}"><legend>${label}</legend>${options.map((o) => `<label><input type="radio" name="${name}" value="${e(o.value)}"${required}${String(field.defaultValue) === String(o.value) ? ' checked' : ''}> ${e(o.label)}</label>`).join('')}</fieldset>` : `<select id="${id}" name="${name}"${required}><option value="">—</option>${options.map((o) => `<option value="${e(o.value)}"${String(field.defaultValue) === String(o.value) ? ' selected' : ''}>${e(o.label)}</option>`).join('')}</select>`;
    } else if (type === 'checkbox') {
      input = `<label><input id="${id}" type="checkbox" name="${name}" value="true"${required}${field.defaultValue ? ' checked' : ''}> ${label}</label>`;
    } else {
      const inputType = ['email', 'number', 'date', 'tel'].includes(type) ? type : 'text';
      input = `<input id="${id}" type="${inputType}" name="${name}"${required}${placeholder}${value}>`;
    }
    return `<div class="cms-field">${['checkbox', 'radio'].includes(type) ? input : `<label for="${id}">${label}${required ? ' *' : ''}</label>${input}`}</div>`;
  }).join('');
  const confirmation = typeof form.confirmationMessage === 'string' ? `<p>${e(form.confirmationMessage)}</p>` : lexical(form.confirmationMessage, ctx);
  return `${block.enableIntro ? lexical(block.introContent, ctx) : ''}<h2>${e(form.title)}</h2><form class="cms-form" data-form-id="${e(form.id)}" data-confirmation-type="${e(form.confirmationType || 'message')}" data-redirect="${e(linkUrl(form.redirect, ctx.site, ctx.locale) || safeUrl(form.redirect?.url) || '')}"><div class="honeypot" aria-hidden="true"><label>Website<input name="__eshobe_website_check" tabindex="-1" autocomplete="off"></label></div>${fields}<button class="cms-button" type="submit">${e(form.submitButtonLabel || ctx.t.send)}</button><p class="form-status" role="status" aria-live="polite"></p>${confirmation ? `<template data-confirmation>${confirmation}</template>` : ''}</form>`;
}
