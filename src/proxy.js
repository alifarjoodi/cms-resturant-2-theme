import { Readable } from 'node:stream';
import { readBody } from './security.js';

const reads = new Set(['site', 'pages', 'posts', 'products', 'categories', 'menus', 'header', 'footer', 'store', 'theme', 'media', 'search', 'forms', 'comments', 'content-type-definitions', 'content-entries', 'taxonomy-definitions', 'taxonomy-terms', 'entry-term-relations', 'content-relations']);
const writes = new Set(['checkout', 'form-submissions']);

export function cmsOwnedApi(pathname, method) {
  if (pathname === '/api/health' || pathname === '/api/revalidate') return false;
  if (pathname.startsWith('/api/media/file/') && ['GET', 'HEAD'].includes(method)) return true;
  if (pathname === '/api/checkout/callback' && ['GET', 'POST'].includes(method)) return true;
  if (pathname === '/api/payments/methods' && method === 'GET') return true;
  const collection = pathname.slice(5).split('/')[0];
  if (pathname.startsWith('/api/') && reads.has(collection) && ['GET', 'HEAD'].includes(method)) return true;
  return pathname === `/api/${collection}` && writes.has(collection) && method === 'POST';
}

export async function proxyApi(req, res, url, config, site) {
  if (!cmsOwnedApi(url.pathname, req.method)) return false;
  if (!config.cmsUrl || config.demo || site?.status !== 'active') {
    res.writeHead(config.demo ? 403 : 503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: false, message: config.demo ? 'This is a design preview. Checkout and CMS writes are disabled.' : 'The store is not available.' }));
    return true;
  }
  if (req.headers['x-eshobe-theme-proxy']) {
    res.writeHead(508, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, message: 'CMS proxy loop detected. Check ESHOBE_CMS_URL routing.' }));
    return true;
  }
  const incoming = new URL(req.url, 'http://theme.internal');
  if (['draft', 'overrideAccess', 'site', 'siteId', 'tenant'].some((key) => incoming.searchParams.has(key))) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, message: 'Unsupported public API parameter.' }));
    return true;
  }
  const isWrite = ['POST', 'PATCH', 'PUT'].includes(req.method);
  const body = isWrite ? await readBody(req, 32_768) : undefined;
  const headers = {
    // Visitor writes are Host-scoped, unlike server reads which use the key.
    // Never attach ESHOBE_API_KEY to visitor traffic or forward their cookies.
    Host: req.headers.host,
    Accept: req.headers.accept || 'application/json',
    'x-eshobe-theme-proxy': '1',
    // Trust only the platform's sanitised client-IP header, never a visitor-supplied chain.
    ...(req.headers['x-real-ip'] ? { 'x-real-ip': req.headers['x-real-ip'], 'x-forwarded-for': req.headers['x-real-ip'] } : { 'x-forwarded-for': req.socket.remoteAddress || '' }),
    'x-forwarded-proto': req.socket.encrypted ? 'https' : 'http',
  };
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  if (req.headers['accept-language']) headers['accept-language'] = req.headers['accept-language'];
  if (req.headers['user-agent']) headers['user-agent'] = req.headers['user-agent'];
  try {
    const upstream = await fetch(`${config.cmsUrl}${url.pathname}${url.search}`, {
      method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(25_000),
    });
    const output = { 'cache-control': isWrite ? 'no-store' : 'public, max-age=30' };
    for (const name of ['content-type', 'location', 'retry-after', 'etag', 'last-modified', 'cache-control', 'pragma']) {
      if (upstream.headers.has(name)) output[name] = upstream.headers.get(name);
    }
    res.writeHead(upstream.status, output);
    if (req.method === 'HEAD' || !upstream.body) res.end();
    else Readable.fromWeb(upstream.body).pipe(res);
  } catch {
    if (!res.headersSent) res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'retry-after': '10', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: false, message: 'ارتباط با فروشگاه برقرار نشد. لطفاً دوباره تلاش کنید.' }));
  }
  return true;
}
