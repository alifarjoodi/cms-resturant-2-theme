import { majorToMinor } from '@eshobe/site-runtime';
// Explicit preview fixtures only. Never used as a fallback for a failed CMS read.
const drinks = [
  ['Espresso', 'Espresso bar', 'A little cup of comfort, indulge in the deep, roasted flavor of our espresso.', 'A little cup of comfort — a dense, syrupy shot pulled slow for a deep, roasted finish that lingers.', 'Dark chocolate|Toasted hazelnut|Brown sugar', 5, '30 ml', '88 °C', 'espresso'],
  ['Double Espresso', 'Espresso bar', 'A little cup of comfort, indulge in the deep, roasted flavor of our espresso.', 'A little cup of comfort — twice the coffee, twice the crema. Bold, velvety and unapologetically intense.', 'Cocoa nib|Caramel|Smoked cedar', 5, '60 ml', '88 °C', 'double'],
  ['Americano', 'Long black', 'A little cup of comfort, indulge in the deep, roasted flavor of our espresso.', 'A little cup of comfort — espresso lengthened with hot water, opening a clean, aromatic cup with a gentle bitterness.', 'Roasted almond|Citrus peel|Black tea', 4, '180 ml', '92 °C', 'americano'],
  ['Cappuccino', 'Milk & foam', 'A little cup of comfort, indulge in the deep, roasted flavor of our espresso.', 'A little cup of comfort — a bold espresso heart beneath a dome of velvety microfoam and a whisper of cocoa.', 'Vanilla bean|Cocoa dust|Steamed milk', 3, '160 ml', '88 °C', 'cappuccino'],
  ['Latte', 'Milk & foam', 'A little cup of comfort, indulge in the deep, roasted flavor of our espresso.', 'A little cup of comfort — silky steamed milk poured over espresso and finished with a hand-drawn heart.', 'Fresh cream|Honey|Toasted grain', 2, '240 ml', '85 °C', 'latte'],
  ['Mocha', 'Sweet & dark', 'A little cup of comfort, indulge in the deep, roasted flavor of our espresso.', 'A little cup of comfort — rich cocoa folded into espresso and steamed milk. Dessert, served in a cup.', '70% chocolate|Molasses|Velvet cream', 3, '240 ml', '85 °C', 'mocha'],
  ['Macchiato', 'Espresso bar', 'A little cup of comfort, indulge in the deep, roasted flavor of our espresso.', 'A little cup of comfort — an espresso marked with a spot of foam. Small, strong and pleasingly rounded.', 'Burnt sugar|Hazelnut|Warm cream', 4, '40 ml', '88 °C', 'macchiato'],
  ['Flat White', 'Milk & foam', 'A little cup of comfort, indulge in the deep, roasted flavor of our espresso.', 'A little cup of comfort — a double ristretto base under a thin, glossy layer of silky microfoam.', 'Toffee|Walnut|Buttered toast', 3, '170 ml', '88 °C', 'flatwhite'],
];
export const demoSite = {
  id: '00000000-0000-4000-8000-000000000001', contractVersion: 1,
  name: 'Coffee Shop', slug: 'coffee-preview', domain: 'coffee.example', status: 'active', type: 'store',
  defaultLocale: 'en', availableLocales: ['en'],
  branding: { displayName: 'COFFEE SHOP', tagline: 'BREWED FOR THE BOLD' },
  store: { currency: 'USD', paymentProvider: 'bank' },
  media: { origin: 'https://coffee.example', basePath: '/api/media/file' },
  theme: { primary: '#6f4328', accent: '#c98c4d', background: '#fff8e8', foreground: '#35241b', radius: 'lg', lineHeight: 1.8 },
  themeRuntime: { theme: { key: 'coffee-poster' }, settings: {}, bindings: {} },
  blocks: ['content', 'mediaBlock', 'cta', 'features', 'testimonials', 'faq', 'contact', 'formBlock', 'productGrid', 'pricing', 'logos'],
  paymentMethods: [], menus: { items: [], locations: [] },
};
export const demoProducts = drinks.map((d, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
  title: d[0], slug: d[0].toLowerCase().replaceAll(' ', '-'), summary: d[2],
  price: majorToMinor([5, 5, 4, 3, 2, 3, 4, 3][index], 'USD'), productType: 'simple', _status: 'published',
  preview: { description: d[3], notes: d[4], intensity: d[5], volume: d[6], temperature: d[7], artwork: d[8], category: d[1] },
}));
const envelope = (docs) => ({ docs, totalDocs: docs.length, totalPages: 1, page: 1, hasNextPage: false, hasPrevPage: false });
export class DemoClient {
  demo = true;
  async getSite() { return structuredClone(demoSite); }
  async list(collection, query = {}) {
    if (collection === 'products') {
      let docs = demoProducts;
      const slug = query.where?.slug?.equals;
      if (slug) docs = docs.filter((p) => p.slug === slug);
      if (query.limit) docs = docs.slice(0, query.limit);
      return envelope(structuredClone(docs));
    }
    if (collection === 'pages' && (!query.where?.slug?.equals || query.where.slug.equals === 'home')) {
      return envelope([{ id: 'demo-home', title: 'Coffee Shop', slug: 'home', _status: 'published', layout: [{ id: 'menu', blockType: 'productGrid', populateBy: 'collection', limit: 8, columns: '2', showBuyButton: true }] }]);
    }
    return envelope([]);
  }
  async bySlug(collection, slug) { return (await this.list(collection, { where: { slug: { equals: slug } } })).docs[0] ?? null; }
  async byId(collection, id) { return (await this.list(collection)).docs.find((doc) => doc.id === id) ?? null; }
  async getHomePage() { return (await this.list('pages')).docs[0]; }
  async productsForBlock(block, site, locale, settings) { return (await this.list('products', { limit: block.limit ?? settings.menuLimit })).docs; }
  async getRedirect() { return null; }
  async getNavigation() { return { header: [], footer: [] }; }
  invalidate() {}
}
