import type { Block } from 'payload'

/**
 * A CMS-editable source for the original Coffee Shop poster. The presentation
 * is intentionally not configurable: only copy and drink data are editable.
 */
export const CoffeeMenu: Block = {
  slug: 'coffeeMenu',
  interfaceName: 'CoffeeMenuBlock',
  labels: { singular: 'منوی کافه', plural: 'منوی کافه' },
  fields: [
    {
      name: 'menuTitle',
      type: 'text',
      label: 'عنوان منو',
      localized: true,
      defaultValue: 'MENU & PRICE LIST',
    },
    {
      name: 'brandName',
      type: 'text',
      label: 'نام برند',
      localized: true,
      defaultValue: 'COFFEE SHOP',
    },
    {
      name: 'tagline',
      type: 'text',
      label: 'شعار بالای پوستر',
      localized: true,
      defaultValue: 'BREWED FOR THE BOLD',
    },
    {
      name: 'brandDescription',
      type: 'textarea',
      label: 'توضیح برند',
      localized: true,
      defaultValue: 'A perfect cup of coffee, made\njust for you. Energize your\nmorning and fuel your day with\nour premium blends.',
    },
    {
      name: 'sloganLine1',
      type: 'text',
      label: 'شعار پایینی — خط اول',
      localized: true,
      defaultValue: 'BREWED',
    },
    {
      name: 'sloganLine2',
      type: 'text',
      label: 'شعار پایینی — خط دوم',
      localized: true,
      defaultValue: 'FOR COMFORT,',
    },
    {
      name: 'sloganLine3',
      type: 'text',
      label: 'شعار پایینی — خط سوم',
      localized: true,
      defaultValue: 'CRAFTED',
    },
    {
      name: 'sloganLine4',
      type: 'text',
      label: 'شعار پایینی — خط چهارم',
      localized: true,
      defaultValue: 'FOR YOU',
    },
    {
      name: 'currencyLabel',
      type: 'text',
      label: 'نماد/واحد قیمت',
      localized: true,
      defaultValue: '$',
    },
    {
      name: 'drinks',
      type: 'array',
      label: 'نوشیدنی‌ها (ترتیب کارت‌ها را تغییر ندهید تا ترکیب‌بندی اصلی حفظ شود)',
      minRows: 1,
      maxRows: 8,
      admin: { initCollapsed: true },
      defaultValue: [
        { name: 'Espresso', category: 'Espresso bar', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — a dense, syrupy shot pulled slow for a deep, roasted finish that lingers.', notes: 'Dark chocolate|Toasted hazelnut|Brown sugar', intensity: 5, volume: '30 ml', temperature: '88 °C', artwork: 'espresso' },
        { name: 'Double Espresso', category: 'Espresso bar', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — twice the coffee, twice the crema. Bold, velvety and unapologetically intense.', notes: 'Cocoa nib|Caramel|Smoked cedar', intensity: 5, volume: '60 ml', temperature: '88 °C', artwork: 'double' },
        { name: 'Americano', category: 'Long black', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — espresso lengthened with hot water, opening a clean, aromatic cup with a gentle bitterness.', notes: 'Roasted almond|Citrus peel|Black tea', intensity: 4, volume: '180 ml', temperature: '92 °C', artwork: 'americano' },
        { name: 'Cappuccino', category: 'Milk & foam', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — a bold espresso heart beneath a dome of velvety microfoam and a whisper of cocoa.', notes: 'Vanilla bean|Cocoa dust|Steamed milk', intensity: 3, volume: '160 ml', temperature: '88 °C', artwork: 'cappuccino' },
        { name: 'Latte', category: 'Milk & foam', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — silky steamed milk poured over espresso and finished with a hand-drawn heart.', notes: 'Fresh cream|Honey|Toasted grain', intensity: 2, volume: '240 ml', temperature: '85 °C', artwork: 'latte' },
        { name: 'Mocha', category: 'Sweet & dark', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — rich cocoa folded into espresso and steamed milk. Dessert, served in a cup.', notes: '70% chocolate|Molasses|Velvet cream', intensity: 3, volume: '240 ml', temperature: '85 °C', artwork: 'mocha' },
        { name: 'Macchiato', category: 'Espresso bar', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — an espresso marked with a spot of foam. Small, strong and pleasingly rounded.', notes: 'Burnt sugar|Hazelnut|Warm cream', intensity: 4, volume: '40 ml', temperature: '88 °C', artwork: 'macchiato' },
        { name: 'Flat White', category: 'Milk & foam', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — a double ristretto base under a thin, glossy layer of silky microfoam.', notes: 'Toffee|Walnut|Buttered toast', intensity: 3, volume: '170 ml', temperature: '88 °C', artwork: 'flatwhite' },
      ],
      fields: [
        { name: 'name', type: 'text', label: 'نام', localized: true, required: true },
        { name: 'category', type: 'text', label: 'دسته‌بندی', localized: true },
        { name: 'description', type: 'textarea', label: 'متن کارت', localized: true },
        { name: 'detail', type: 'textarea', label: 'توضیح پنجرهٔ جزئیات', localized: true },
        { name: 'notes', type: 'text', label: 'طعم‌ها (با | جدا کنید)', localized: true },
        { name: 'price', type: 'number', label: 'قیمت', required: true, min: 0 },
        { name: 'intensity', type: 'number', label: 'شدت (۱ تا ۵)', min: 1, max: 5, defaultValue: 3 },
        { name: 'volume', type: 'text', label: 'حجم', localized: true },
        { name: 'temperature', type: 'text', label: 'دمای سرو', localized: true },
        {
          name: 'artwork',
          type: 'select',
          label: 'طرح فنجان (فقط نقش‌های اصلی قالب)',
          required: true,
          defaultValue: 'espresso',
          options: ['espresso', 'double', 'americano', 'cappuccino', 'latte', 'mocha', 'macchiato', 'flatwhite'],
        },
      ],
    },
  ],
}
