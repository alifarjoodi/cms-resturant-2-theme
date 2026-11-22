import { Readable } from 'node:stream';
import http from 'node:http';
import https from 'node:https';
import { readBody } from './security.js';

const reads = new Set(['site', 'pages', 'posts', 'products', 'categories', 'menus', 'header', 'footer', 'store', 'theme', 'media', 'search', 'forms', 'comments', 'content-type-definitions', 'content-entries', 'taxonomy-definitions', 'taxonomy-terms', 'entry-term-relations', 'content-relations']);
const writes = new Set(['checkout', 'form-submissions']);

/**
 * A POST whose `Host` header actually arrives.
 *
 * `fetch()` cannot carry one: `Host` is a *forbidden request header* in the Fetch
 * standard, and undici follows the spec by dropping it and deriving the header
 * from the URL. That silently rewrote every visitor write to the CMS's own host,
 * so checkout answered `unknown host` and no storefront order ever reached the
 * CMS — from a theme whose comment says "visitor writes are Host-scoped".
 *
 * `node:http` sends what it is given. Visitor writes are small JSON, so buffering
 * the answer is fine here; media reads keep streaming through `fetch`.
 */
/**
 * One line per visitor write, so a submission that does not become an order can
 * be found instead of guessed at.
 *
 * The status is the whole point: a `400` says the CMS refused it (with its own
 * Persian message), a `200` names the order it created, and *no line at all*
 * says the device never reached this deployment — three different failures that
 * used to look identical from the outside.
 *
 * Nothing about the buyer is logged: no body, no name, no phone, no cookie.
 */
const logVisitorWrite = ({ host, path, status, ms, body }) => {
  const summary = { event: 'visitor_write', host, path, status, ms };
  let parsed;
  try { parsed = body?.length ? JSON.parse(body.toString('utf8')) : null; } catch { parsed = null; }
  if (status >= 200 && status < 300) {
    if (parsed?.orderId) summary.orderId = String(parsed.orderId);
    if (parsed?.reference) summary.reference = String(parsed.reference);
    if (parsed?.retry === true) summary.retry = true;
    // A 200 that names no order is the honeypot drop: `{ok:true, message:'ثبت شد.'}`.
    if (!parsed?.orderId && parsed?.message) {
      summary.message = String(parsed.message).replace(/\s+/g, ' ').slice(0, 200);
    }
  } else if (parsed?.message) {
    summary.message = String(parsed.message).replace(/\s+/g, ' ').slice(0, 200);
  }
  console.log(JSON.stringify(summary));
};

const writeWithHost = (target, { method, headers, body, timeoutMs = 25_000 }) =>
  new Promise((resolve, reject) => {
    const url = new URL(target);
    const transport = url.protocol === 'https:' ? https : http;
    const payload = body ? Buffer.from(body) : null;
    const request = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method,
      headers: { ...headers, ...(payload ? { 'content-length': String(payload.length) } : {}) },
      timeout: timeoutMs,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () =>
        resolve({ status: response.statusCode || 502, headers: response.headers, body: Buffer.concat(chunks) }),
      );
    });
    request.on('timeout', () => request.destroy(new Error('upstream timeout')));
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });

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
    if (isWrite) {
      // Host-scoped by construction: see writeWithHost above.
      const startedAt = Date.now();
      const upstream = await writeWithHost(`${config.cmsUrl}${url.pathname}${url.search}`, { method: req.method, headers, body });
      logVisitorWrite({
        host: headers.Host, path: url.pathname, status: upstream.status,
        ms: Date.now() - startedAt, body: upstream.body,
      });
      const output = { 'cache-control': 'no-store' };
      for (const name of ['content-type', 'location', 'retry-after', 'etag', 'last-modified', 'pragma']) {
        const value = upstream.headers[name];
        if (value) output[name] = value;
      }
      res.writeHead(upstream.status, output);
      res.end(req.method === 'HEAD' ? undefined : upstream.body);
      return true;
    }
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
    if (isWrite) console.log(JSON.stringify({ event: 'visitor_write', host: headers.Host, path: url.pathname, status: 'unreachable' }));
    if (!res.headersSent) res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'retry-after': '10', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: false, message: 'ارتباط با فروشگاه برقرار نشد. لطفاً دوباره تلاش کنید.' }));
  }
  return true;
}
