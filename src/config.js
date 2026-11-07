import { contractVersion, isCurrencyCode } from '@eshobe/site-runtime';

export function readConfig(env = process.env) {
  const origin = (value) => {
    if (!value) return '';
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('CMS and public origins must be HTTP(S), without credentials.');
    }
    return url.origin;
  };
  const ttl = Number(env.CACHE_TTL_SECONDS ?? 60);
  return Object.freeze({
    cmsUrl: origin(env.ESHOBE_CMS_URL),
    apiKey: env.ESHOBE_API_KEY ?? '',
    siteId: env.ESHOBE_SITE_ID ?? '',
    siteDomain: env.ESHOBE_SITE_DOMAIN ?? '',
    publicOrigin: origin(env.ESHOBE_PUBLIC_ORIGIN),
    revalidateSecret: env.ESHOBE_REVALIDATE_SECRET ?? '',
    receiptSecret: env.ESHOBE_RECEIPT_SECRET || env.PAYLOAD_SECRET || '',
    demo: env.DEMO_MODE === 'true',
    ttl: Number.isFinite(ttl) ? Math.max(10, Math.min(300, ttl)) * 1000 : 60_000,
    port: Number(env.PORT || 3000),
    host: env.HOST || '0.0.0.0',
    locale: env.ESHOBE_DEFAULT_LOCALE || 'fa',
    currency: isCurrencyCode(env.ESHOBE_CURRENCY) ? env.ESHOBE_CURRENCY : 'IRT',
    contractVersion,
  });
}

export function configurationError(config) {
  if (config.demo) return '';
  if (!config.cmsUrl) return 'ESHOBE_CMS_URL is not configured.';
  if (!config.apiKey) return 'ESHOBE_API_KEY is not configured.';
  if (!config.siteId) return 'ESHOBE_SITE_ID is not configured.';
  return '';
}
