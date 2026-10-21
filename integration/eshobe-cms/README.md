# اتصال قالب منوی کافه به Eshobe CMS

این بسته، قالب موجود در ریشهٔ مخزن را به یک بلوک قابل‌ویرایش برای Payload CMS 3 / Next.js تبدیل می‌کند. اجزای ظاهری، ترتیب کارت‌ها، طرح فنجان‌ها، CSS و زمان‌بندی انیمیشن‌ها از همان قالب نگه داشته شده‌اند؛ فقط متن و دادهٔ ۸ نوشیدنی از پنل CMS می‌آیند. پوستهٔ ثابت تمام‌صفحه، سربرگ و پابرگ عادی سایت را می‌پوشاند تا ترکیب‌بندی پوستر داخل CMS هم همان قاب را داشته باشد.

## فایل‌های این بسته

- `CoffeeMenu/config.ts` — فیلدهای Payload، پیش‌فرض‌های همان منوی هشت‌تایی و فیلدهای بومی‌سازی‌شده.
- `CoffeeMenu/Component.client.tsx` — نمایش React و تعامل‌های کارت، جزئیات، علاقه‌مندی و سبد.
- `CoffeeMenu/coffee-menu.css` — نسخهٔ محدودشده به `.coffee-menu-shell` از CSS اصلی؛ قوانین پوستر/حرکت حفظ شده‌اند و استایل صفحه‌های دیگر CMS را دستکاری نمی‌کند.

## نصب در مخزن `hamidnoshady/eshobe-cms`

1. پوشهٔ `CoffeeMenu` را بدون تغییر به `src/blocks/CoffeeMenu/` کپی کنید.
2. در `src/blocks/index.ts`:
   - وارد کنید: `import { CoffeeMenu } from './CoffeeMenu/config'`
   - در `library` اضافه کنید: `{ block: CoffeeMenu, siteTypes: ['store'] }`
3. در `src/blocks/RenderBlocks.tsx`:
   - وارد کنید: `import { CoffeeMenuBlock } from '@/blocks/CoffeeMenu/Component.client'`
   - به `blockComponents` اضافه کنید: `coffeeMenu: CoffeeMenuBlock,`
4. در `src/app/(site)/layout.tsx`، فایل CSS را بعد از `./globals.css` وارد کنید:

   ```ts
   import '@/blocks/CoffeeMenu/coffee-menu.css'
   ```

5. از ریشهٔ مخزن CMS، `pnpm generate:types` و `pnpm generate:importmap` را اجرا کنید. سپس در صفحهٔ یک سایت از نوع `store` بلوک «منوی کافه» را اضافه کنید.

بلوک عمداً فقط برای نوع `store` در picker قابل انتخاب است. متن‌ها قابل بومی‌سازی‌اند؛ برای حفظ دقیق پوستر، هشت نوشیدنی و ترتیب اصلی‌شان را نگه دارید. فیلد «طرح فنجان» یکی از هشت نقش CSS موجود را انتخاب می‌کند و تصویر تازه‌ای جایگزین نمی‌کند.

> این پوشه یک بستهٔ ادغام برای کپی به مخزن CMS است؛ مخزن فعلی یک قالب HTML/CSS مستقل است و کد Payload یا وابستگی‌های Eshobe CMS را در خود ندارد. فایل‌های `index.html`، `style.css` و `app.js` اصلی در ریشه دست‌نخورده باقی می‌مانند.
