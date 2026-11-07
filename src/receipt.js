import { formatPrice, formatNumber, formatDate, toLocaleDigits } from '@eshobe/site-runtime';
import { escapeHtml as e } from './security.js';
import { UUID, relationId } from './routing.js';
import { verifyReceipt } from './security.js';

export async function renderReceipt(ctx, orderId, params) {
  const { site, client, config, t, locale } = ctx;
  if (!orderId || !UUID.test(orderId) || !verifyReceipt(config.receiptSecret, site.id, orderId, params.get('r'))) return null;
  // Signature verification happens BEFORE the credentialed order read. Never
  // cache receipts or use the revalidation secret as the receipt signing key.
  let result;
  try { result = await client.list('orders', { where: { id: { equals: orderId }, site: { equals: site.id } }, locale, depth: 0, limit: 1 }, { cache: false });
  } catch { return null; }
  const order = result.docs[0];
  if (!order || String(relationId(order.site)) !== String(site.id)) return null;
  const money = (value) => formatPrice(Number(value ?? 0), order.currency, locale);
  const items = order.items?.length ? order.items : [{ productTitle: order.productTitle, quantity: order.quantity, unitPrice: order.unitPrice, total: order.total ?? order.subtotal }];
  const row = (label, value, cls = '') => `<div class="receipt-row ${cls}"><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`;
  let instructions = '';
  if (order.status !== 'paid') {
    try {
      const store = await client.list('store', { locale, limit: 1 }, { cache: false });
      instructions = store.docs[0]?.paymentInstructions || '';
    } catch { /* Payment instructions are optional; do not expose an internal error. */ }
  }
  const status = t[order.status] || order.status;
  const body = `<article class="receipt"><div class="receipt__status" data-status="${e(order.status)}">${e(status)}</div>
    <p>${e(order.status === 'paid' ? t.paidNote : t.pendingNote)}</p>
    ${params.get('m') === 'failed' ? `<p class="notice notice--error">${e(t.failedPayment)}</p>` : ''}
    <dl>${row(t.reference, toLocaleDigits(String(order.reference || order.id), locale))}${row(t.status, status)}${order.createdAt ? row(ctx.locale === 'fa' ? 'تاریخ' : 'Date', formatDate(order.createdAt, locale)) : ''}${row(t.name, order.buyer?.name)}${row(t.phone, toLocaleDigits(order.buyer?.phone || '', locale))}</dl>
    <div class="receipt-lines">${items.map((item) => `<div class="receipt-line"><div><strong>${e(item.productTitle)}</strong>${item.variationLabel ? `<small>${e(item.variationLabel)}</small>` : ''}<small>${e(t.quantity)}: ${e(formatNumber(item.quantity, locale))} · ${e(money(item.unitPrice))}</small></div><strong>${e(money(item.total ?? item.subtotal))}</strong></div>`).join('')}</div>
    <dl class="receipt-totals">${row(t.subtotal, money(order.subtotal))}${Number(order.discountTotal) ? row(`${t.discount}${order.coupons?.length ? ` (${order.coupons.map((c) => c.code).join(', ')})` : ''}`, `−${money(order.discountTotal)}`) : ''}${Number(order.shippingTotal) ? row(t.shipping, money(order.shippingTotal)) : ''}${Number(order.taxTotal) ? row(t.tax, money(order.taxTotal)) : ''}${(order.fees ?? []).map((fee) => row(fee.label || fee.name || t.fees, money(fee.total))).join('')}${row(t.total, money(order.total), 'receipt-total')}</dl>
    ${order.status !== 'paid' && instructions ? `<section class="receipt-instructions"><h2>${e(t.instructions)}</h2><p>${e(instructions)}</p></section>` : ''}
    ${order.buyer?.note ? `<section class="receipt-instructions"><h2>${e(t.note)}</h2><p>${e(order.buyer.note)}</p></section>` : ''}
  </article>`;
  return { body, title: t.receipt };
}
