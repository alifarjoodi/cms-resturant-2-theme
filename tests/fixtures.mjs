import http from 'node:http';
import { majorToMinor } from '@eshobe/site-runtime';
import { demoSite, demoProducts } from '../src/demo.js';
import { receiptSignature } from '../src/security.js';

export const SITE_ID = '11111111-1111-4111-8111-111111111111';
export const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
export const ORDER_ID = '33333333-3333-4333-8333-333333333333';
export const RECEIPT_SECRET = 'test-receipt-secret-not-a-real-credential';
export const REVALIDATE_SECRET = 'test-revalidation-secret';
export const API_KEY = 'test-site-key-not-a-real-credential';
export const simple = { id: PRODUCT_ID, title: 'قهوه آزمایشی', slug: 'coffee', summary: 'توضیح کوتاه', price: majorToMinor(180000, 'IRT'), productType: 'simple', _status: 'published', trackInventory: true, inventory: 4, image: { url: '/api/media/file/coffee.png', alt: 'قهوه', width: 600, height: 600 }, body: { root: { type: 'root', direction: 'rtl', children: [{ type: 'paragraph', direction: 'rtl', children: [{ type: 'text', text: 'توضیح کامل محصول' }] }] } } };
export const variable = { id: '44444444-4444-4444-8444-444444444444', title: 'قهوه گزینه‌دار', slug: 'variable-coffee', price: 180000, productType: 'variable', _status: 'published', attributes: [{ key: 'size', name: 'اندازه', usedForVariation: true, options: [{ value: 'کوچک' }, { value: 'بزرگ' }] }], variations: [{ key: 'small-stable', label: 'کوچک', price: 180000, active: true, trackInventory: true, inventory: 2, attributeValues: { size: 'کوچک' } }, { key: 'large-stable', label: 'بزرگ', price: 230000, active: true, trackInventory: false, attributeValues: { size: 'بزرگ' } }, { key: 'inactive', label: 'غیرفعال', price: 1, active: false }] };
const posts = [{ id: 'post-1', title: 'داستان قهوه', slug: 'coffee-story', _status: 'published', publishedAt: '2024-05-02T10:00:00Z', updatedAt: '2024-05-02T10:00:00Z', meta: { description: 'خلاصه مقاله' }, content: { root: { type: 'root', direction: 'rtl', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'متن مقاله' }] }] } } }];
export const allBlocks = [
  { blockType: 'content', columns: [{ size: 'half', richText: { root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: 'متن ستون' }] }] } } }] },
  { blockType: 'mediaBlock', media: simple.image, caption: 'توضیح تصویر', aspect: '16/9' },
  { blockType: 'cta', richText: { root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: 'دعوت به اقدام' }] }] } }, links: [] },
  { blockType: 'features', heading: 'ویژگی‌ها', items: [{ title: 'تازه', description: 'برشته‌کاری تازه' }] },
  { blockType: 'testimonials', items: [{ quote: 'خوش‌طعم', author: 'مشتری' }] },
  { blockType: 'faq', items: [{ question: 'سؤال؟', answer: 'پاسخ' }] },
  { blockType: 'contact', phones: ['09121234567'], email: 'shop@example.com' },
  { blockType: 'formBlock', form: 'form-1' },
  { blockType: 'gallery', images: [simple.image] },
  { blockType: 'team', members: [{ name: 'عضو تیم', role: 'باریستا' }] },
  { blockType: 'pricing', plans: [{ name: 'اشتراک', price: 50000, unit: 'واحد', features: ['ویژگی'] }] },
  { blockType: 'logos', logos: [simple.image] },
  { blockType: 'archive', populateBy: 'collection', limit: 3 },
];
const forms = [{ id: 'form-1', title: 'تماس با ما', fields: [{ id: 'f1', blockType: 'text', name: 'name', label: 'نام', required: true }, { id: 'f2', blockType: 'email', name: 'email', label: 'ایمیل', required: true }, { id: 'f3', blockType: 'textarea', name: 'message', label: 'پیام' }, { id: 'f4', blockType: 'checkbox', name: 'consent', label: 'موافقم' }], confirmationType: 'message', confirmationMessage: { root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: 'پیام دریافت شد' }] }] } } }];
export const order = { id: ORDER_ID, site: SITE_ID, reference: 'AB123', status: 'pending', currency: 'IRT', buyer: { name: 'علی رضایی', phone: '09121234567', note: 'یادداشت خریدار' }, items: [{ productTitle: 'قهوه اول', variationLabel: 'بزرگ', quantity: 2, unitPrice: 180000, subtotal: 360000, total: 360000 }, { productTitle: 'قهوه دوم', quantity: 1, unitPrice: 120000, subtotal: 120000, total: 120000 }], subtotal: 480000, discountTotal: 20000, shippingTotal: 30000, taxTotal: 10000, fees: [{ label: 'بسته‌بندی', total: 5000 }], total: 505000, coupons: [{ code: 'WELCOME', discount: 20000 }], productTitle: 'قهوه اول', quantity: 2, unitPrice: 180000 };

export async function startMockCms() {
  const state = { requests: [], checkouts: [], forms: [], mode: 'confirmation', unavailable: false, siteCalls: 0, orderReads: 0, hosts: [] };
  const site = { ...structuredClone(demoSite), blocks: ['content','mediaBlock','cta','features','testimonials','faq','contact','formBlock','productGrid','pricing','logos','gallery','team','archive'], id: SITE_ID, name: 'کافه آزمایشی', domain: 'shop.example', defaultLocale: 'fa', availableLocales: ['fa', 'en'], branding: { displayName: 'کافه آزمایشی', tagline: 'طعم خوب زندگی' }, store: { currency: 'IRT', paymentProvider: 'bank' }, themeRuntime: { settings: { menuTitle: 'منوی قهوه', slogan: 'طعم خوب\nبرای لحظه‌ها\nقهوه تازه\nبرای شما' }, bindings: { home: { id: 'home-id', type: 'page', slug: 'خانه', title: 'خانه' } } }, payments: { currency: 'IRT', methods: [{ id: 'test-psp', label: 'درگاه آزمایشی', labelEn: 'Test gateway', mode: 'sandbox', kind: 'psp' }] } };
  const home = { id: 'home-id', title: 'خانه', slug: 'home', _status: 'published', layout: [{ blockType: 'productGrid', populateBy: 'selection', products: [PRODUCT_ID, variable.id], showBuyButton: true, limit: 2 }, ...allBlocks, { blockType: 'unknownFutureBlock' }] };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://cms.internal');
    state.requests.push({ path: url.pathname + url.search, authorization: req.headers.authorization, host: req.headers.host });
    res.setHeader('content-type', 'application/json');
    const send = (value, status = 200) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    if (state.unavailable) return send({ message: 'offline' }, 503);
    if (url.pathname === '/api/site') { state.siteCalls++; return send(req.headers.authorization === `Bearer ${API_KEY}` ? site : { error: 'unknown-host' }, req.headers.authorization === `Bearer ${API_KEY}` ? 200 : 404); }
    if (url.pathname === '/api/checkout' && req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw); state.checkouts.push({ body, headers: req.headers });
      if (state.mode === 'error') return send({ ok: false, available: 1, message: 'تنها یک عدد موجود است.' }, 409);
      if (state.mode === 'rate') { res.setHeader('retry-after', '30'); return send({ ok: false, message: 'کمی صبر کنید.' }, 429); }
      const confirmationUrl = `/fa/checkout/${ORDER_ID}?r=${receiptSignature(RECEIPT_SECRET, SITE_ID, ORDER_ID)}`;
      if (state.mode === 'pending') return send({ ok: true, pending: true, confirmationUrl, message: 'درگاه پیکربندی نشده است.' }, 503);
      if (state.mode === 'redirect') return send({ ok: true, redirectUrl: 'https://psp.example/pay/test', confirmationUrl });
      return send({ ok: true, redirectUrl: null, confirmationUrl });
    }
    if (url.pathname === '/api/form-submissions') { let raw = ''; for await (const c of req) raw += c; state.forms.push(JSON.parse(raw)); return send({ message: 'پیام دریافت شد' }); }
    if (url.pathname === '/api/media/file/coffee.png') { res.setHeader('content-type', 'image/png'); return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6xl8AAAAASUVORK5CYII=', 'base64')); }
    if (req.headers.authorization !== `Bearer ${API_KEY}`) return send({ message: 'Unauthorized' }, 401);
    const collection = url.pathname.split('/')[2];
    if (['pages', 'posts', 'products'].includes(collection) && url.searchParams.get('where[_status][equals]') !== 'published') return send({ message: 'Missing published filter' }, 400);
    let docs = [];
    if (collection === 'pages') docs = url.searchParams.get('where[slug][equals]') === 'about' ? [{ id: 'about-id', slug: 'about', title: 'درباره ما', _status: 'published', layout: allBlocks }] : [home];
    if (collection === 'products') docs = [simple, variable, { id: 'external-id', title: 'محصول خارجی', slug: 'external', price: 1000, productType: 'external', externalUrl: 'https://example.com/buy', _status: 'published' }, { id: 'grouped-id', title: 'گروه', slug: 'grouped', price: 1000, productType: 'grouped', groupedProducts: [simple], _status: 'published' }];
    if (collection === 'posts') docs = posts;
    if (collection === 'forms') docs = forms;
    if (collection === 'search') docs = [{ title: posts[0].title, doc: { relationTo: 'posts', value: 'post-1' } }];
    if (collection === 'store') docs = [{ currency: 'IRT', paymentInstructions: 'پرداخت کارت به کارت با هماهنگی فروشگاه' }];
    if (collection === 'orders') { state.orderReads++; docs = [order]; }
    if (collection === 'redirects' && url.searchParams.get('where[from][equals]') === '/old-menu') docs = [{ from: '/old-menu', to: { type: 'custom', url: '/products/coffee' } }];
    if (url.searchParams.has('site')) docs = [];
    if (collection === 'header') docs = [{ navItems: [{ link: { type: 'custom', label: 'منو', url: '/products' } }] }];
    if (collection === 'footer') docs = [{ navItems: [{ link: { type: 'custom', label: 'تماس', url: '/about' } }] }];
    const slug = url.searchParams.get('where[slug][equals]');
    const id = url.searchParams.get('where[id][equals]');
    if (slug) docs = docs.filter((d) => d.slug === slug);
    if (id) docs = docs.filter((d) => d.id === id);
    if (url.searchParams.get('locale') === 'en' && url.searchParams.get('fallbackLocale') === 'false') docs = [];
    return send({ docs, totalDocs: docs.length, page: 1, hasNextPage: false, hasPrevPage: false });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { state, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}
