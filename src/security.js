import { createHmac, timingSafeEqual } from 'node:crypto';

export function equalSignature(expected, supplied) {
  if (typeof supplied !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function verifyRevalidation(secret, rawBody, signature) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(signature ?? '')) return false;
  // Contract v1: raw bytes only. The timestamp header is NOT concatenated.
  return equalSignature(createHmac('sha256', secret).update(rawBody).digest('hex'), signature.slice(7));
}
export function receiptSignature(secret, siteId, orderId) {
  return createHmac('sha256', secret).update(`eshobe-order-receipt:v1:${siteId}:${orderId}`).digest('base64url').slice(0, 22);
}
export function verifyReceipt(secret, siteId, orderId, receipt) {
  if (!secret || typeof receipt !== 'string' || receipt.length !== 22) return false;
  return equalSignature(receiptSignature(secret, siteId, orderId), receipt);
}
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
export function jsonScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
export async function readBody(req, limit = 65_536) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('Request body too large.'); error.status = 413; throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
