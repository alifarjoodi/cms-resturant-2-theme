/* Money, in the browser, exactly as `@eshobe/site-runtime` formats it on the
 * server (`formatPrice`): the amount in the currency's major units through
 * `Intl.NumberFormat`, the unit word after it, in the locale's own digits.
 *
 * This copy exists because the cart has to price a line the buyer just changed
 * (`quantity × (unit + add-ons)`) before any request is made, and `app.js` is a
 * classic script with no imports. It is a *preview* only: the CMS re-prices
 * every line and the receipt is the number that counts. `tests/contract.test.mjs`
 * loads this file and compares it against the runtime for every supported
 * currency and both locales, so the two cannot drift.
 *
 * Loaded synchronously in the document head, before the deferred `app.js`.
 */
(function (global) {
  'use strict';

  var currencies = {
    EUR: { minorDigits: 2, unit: { en: '€', fa: 'یورو' } },
    IRR: { minorDigits: 0, unit: { en: 'IRR', fa: 'ریال' } },
    IRT: { minorDigits: 0, unit: { en: 'Toman', fa: 'تومان' } },
    USD: { minorDigits: 2, unit: { en: '$', fa: 'دلار' } }
  };

  function isCurrency(code) {
    return Object.prototype.hasOwnProperty.call(currencies, code);
  }

  function intlLocale(locale) {
    return locale === 'fa' ? 'fa-IR' : locale;
  }

  /** Minor units -> major units (10 for Toman/Rial, 100 for Dollar/Euro). */
  function scale(code) {
    return Math.pow(10, currencies[code].minorDigits);
  }

  function formatNumber(value, locale, options) {
    return new Intl.NumberFormat(intlLocale(locale), options).format(value);
  }

  /** Same contract as the runtime: '' for anything that is not a finite number. */
  function formatPrice(minor, code, locale, options) {
    if (typeof minor !== 'number' || !Number.isFinite(minor)) return '';
    if (!isCurrency(code)) return '';
    var currency = currencies[code];
    var amount = formatNumber(minor / scale(code), locale, {
      maximumFractionDigits: currency.minorDigits,
      minimumFractionDigits: currency.minorDigits
    });
    if (options && options.hideUnit) return amount;
    var unit = currency.unit[locale] || currency.unit.en;
    return amount + ' ' + unit;
  }

  /** A signed add-on delta: `+۲۰٬۰۰۰ تومان`; zero renders as an empty string. */
  function formatDelta(delta, code, locale) {
    if (!Number.isSafeInteger(delta) || delta === 0) return '';
    return (delta > 0 ? '+' : '−') + formatPrice(Math.abs(delta), code, locale);
  }

  global.eshobeMoney = { formatPrice: formatPrice, formatDelta: formatDelta, isCurrency: isCurrency };
})(typeof globalThis !== 'undefined' ? globalThis : this);
