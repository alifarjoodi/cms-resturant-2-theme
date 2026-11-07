/* Original poster interactions + real, single-product Eshobe checkout.
 * No price calculations, tenant selection, credentials or payment verification
 * happen in this file. The CMS is authoritative for every order. */
(() => {
  'use strict';
  const dataNode = document.getElementById('theme-data');
  if (!dataNode) return;
  const data = JSON.parse(dataNode.textContent);
  const products = data.products || [];
  const t = data.strings;
  const detail = document.getElementById('item-detail');
  const checkout = document.getElementById('checkout-dialog');
  const form = document.getElementById('checkout-form');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const liveStatus = document.getElementById('action-status');
  const storageKey = `coffee-poster:favourites:${data.siteKey}`;
  let favourites = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(stored)) favourites = new Set(stored.filter((v) => typeof v === 'string'));
  } catch { /* Private browsing: keep favourites in memory. */ }
  let activeIndex = null;
  let closeTimer = 0;
  let closing = false;
  let submitting = false;
  let lastTrigger = null;
  let detailTrigger = null;
  let checkoutTrigger = null;
  const $ = (selector) => detail.querySelector(selector);
  const setText = (selector, value) => { $(selector).textContent = value || ''; };

  function syncFavourites() {
    document.querySelectorAll('[data-action="favorite"]').forEach((button) => {
      const product = products[Number(button.dataset.index)];
      if (!product) return;
      const on = favourites.has(product.id);
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', `${on ? t.removeFavorite : t.favorite}: ${product.title}`);
    });
  }
  function pop(button) {
    button.classList.remove('is-pop');
    void button.offsetWidth;
    button.classList.add('is-pop');
  }
  syncFavourites();
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="favorite"]');
    if (!button) return;
    const product = products[Number(button.dataset.index)];
    if (!product) return;
    if (favourites.has(product.id)) favourites.delete(product.id); else favourites.add(product.id);
    try { localStorage.setItem(storageKey, JSON.stringify([...favourites])); } catch { /* in-memory fallback */ }
    syncFavourites(); pop(button);
    if (liveStatus) liveStatus.textContent = `${product.title}: ${favourites.has(product.id) ? t.addedFav : t.removedFav}`;
  });

  function currentVariation() {
    const product = products[activeIndex];
    const key = $('#detail-variation').value || product?.selectedVariation;
    return product?.variations.find((v) => v.key === key);
  }
  function updateVariation() {
    const product = products[activeIndex];
    if (!product) return;
    const variation = currentVariation();
    const stock = product.type === 'variable' ? variation?.available : product.stock;
    setText('.detail__price-amount', variation?.price || product.price);
    $('.detail__compare').hidden = !product.compareAt || product.type === 'variable';
    setText('.detail__compare', product.compareAt);
    $('.detail__cta').disabled = !product.canBuy || stock === 0;
    $('.detail__cta > span').textContent = stock === 0 ? t.soldOut : product.externalUrl ? (product.buttonText || t.external) : t.order;
    setText('.detail__stock', stock === 0 ? t.soldOut : '');
    const stage = $('.detail__stage');
    const image = variation?.image || product.largeImage || product.image;
    if (image) {
      const img = document.createElement('img');
      img.src = image; img.alt = ''; img.className = 'detail__photo'; img.decoding = 'async';
      stage.replaceChildren(img);
    } else {
      const cup = document.querySelector(`.item[data-index="${activeIndex}"] .cup`);
      if (cup) stage.replaceChildren(cup.cloneNode(true));
      else stage.replaceChildren();
    }
  }
  function fill(index) {
    activeIndex = index;
    const p = products[index];
    if (!p) return;
    setText('#detail-name', p.title);
    setText('#detail-desc', p.description || p.summary);
    setText('.detail__num', p.num);
    setText('.detail__cat', p.category);
    setText('.detail__ghost', p.num);
    $('.detail__notes').replaceChildren(...p.notes.map((note) => { const li = document.createElement('li'); li.textContent = note; return li; }));
    $('.detail__notes').hidden = !p.notes.length;
    $('[data-stat="intensity"]').hidden = !p.intensity;
    $('[data-stat="volume"]').hidden = !p.volume;
    $('[data-stat="temp"]').hidden = !p.temperature;
    $('.detail__stats').hidden = !p.intensity && !p.volume && !p.temperature;
    setText('[data-field="volume"]', p.volume);
    setText('[data-field="temp"]', p.temperature);
    $('.detail__dots').replaceChildren(...Array.from({ length: 5 }, (_, i) => {
      const dot = document.createElement('span'); dot.className = i < p.intensity ? 'dot is-on' : 'dot'; dot.setAttribute('aria-hidden', 'true'); return dot;
    }));
    $('.detail__dots').setAttribute('aria-label', `${t.intensity}: ${p.intensity || 0} / 5`);
    $('.detail__variation').hidden = p.type !== 'variable';
    const select = $('#detail-variation');
    select.replaceChildren(...p.variations.map((v) => { const option = document.createElement('option'); option.value = v.key; option.textContent = `${v.label} — ${v.price}${v.available === 0 ? ` (${t.soldOut})` : ''}`; return option; }));
    select.value = p.selectedVariation;
    $('.detail__permalink').href = p.href;
    setText('[role="status"]', '');
    updateVariation();
    $('.detail__body').scrollTop = 0;
  }
  function openDetail(index, trigger) {
    if (!products[index]) return;
    clearTimeout(closeTimer); closing = false; detail.classList.remove('is-closing');
    detailTrigger = trigger;
    fill(index);
    if (!detail.open) detail.showModal();
    document.body.classList.add('has-dialog');
    $('.detail__close').focus({ preventScroll: true });
  }
  function closeDetail() {
    if (!detail.open || closing) return;
    closing = true; detail.classList.add('is-closing');
    closeTimer = setTimeout(() => detail.close(), reduceMotion.matches ? 200 : 400);
  }
  $('.detail__close').addEventListener('click', closeDetail);
  detail.addEventListener('cancel', (event) => { event.preventDefault(); closeDetail(); });
  detail.addEventListener('click', (event) => { if (event.target === detail) closeDetail(); });
  detail.addEventListener('close', () => {
    if (detail.open) return;
    closing = false; detail.classList.remove('is-closing');
    if (!checkout.open) document.body.classList.remove('has-dialog');
    if (!checkout.open && detailTrigger?.isConnected) detailTrigger.focus({ preventScroll: true });
  });
  $('#detail-variation').addEventListener('change', updateVariation);

  document.querySelectorAll('.menu-grid .item').forEach((item) => {
    const index = Number(item.dataset.index);
    item.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); openDetail(index, item);
    });
    item.addEventListener('keydown', (event) => {
      if (event.key === ' ') { event.preventDefault(); openDetail(index, item); }
    });
    let hoverTimer;
    item.addEventListener('pointerdown', (event) => { if (event.pointerType !== 'mouse') item.classList.add('is-pressed'); });
    item.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'mouse') return;
      item.classList.remove('is-pressed');
      document.querySelectorAll('.item.is-hovered').forEach((node) => node.classList.remove('is-hovered'));
      item.classList.add('is-hovered');
      clearTimeout(hoverTimer); hoverTimer = setTimeout(() => item.classList.remove('is-hovered'), 1600);
    });
    item.addEventListener('pointercancel', () => item.classList.remove('is-pressed'));
    item.addEventListener('pointerleave', () => item.classList.remove('is-pressed'));
  });
  document.querySelectorAll('.item__action').forEach((button) => {
    const item = button.closest('.cell')?.querySelector('.item');
    button.addEventListener('mouseenter', () => item?.classList.add('is-hovered'));
    button.addEventListener('mouseleave', () => { if (!button.matches(':focus-visible')) item?.classList.remove('is-hovered'); });
    button.addEventListener('focus', () => { if (button.matches(':focus-visible')) item?.classList.add('is-hovered'); });
    button.addEventListener('blur', () => item?.classList.remove('is-hovered'));
  });

  function paymentMethods(methods) {
    const container = document.getElementById('payment-methods');
    const list = Array.isArray(methods) ? methods : [];
    container.closest('fieldset').hidden = !list.length;
    container.replaceChildren(...list.map((method, index) => {
      const label = document.createElement('label');
      const input = document.createElement('input'); input.type = 'radio'; input.name = 'gateway'; input.value = method.id; input.checked = index === 0;
      const text = document.createElement('span'); text.textContent = data.locale === 'fa' ? method.label : method.labelEn || method.label;
      label.append(input, text);
      if (method.mode === 'sandbox') { const badge = document.createElement('small'); badge.textContent = data.locale === 'fa' ? '(آزمایشی)' : '(sandbox)'; label.append(badge); }
      return label;
    }));
  }
  function openCheckout(index, trigger, variationKey) {
    const product = products[index];
    if (!product) return;
    activeIndex = index; checkoutTrigger = trigger;
    form.reset();
    form.elements.quantity.value = '1';
    form.elements.quantity.max = String(Math.min(99, product.stock ?? 99));
    document.getElementById('checkout-product').textContent = product.title;
    document.getElementById('checkout-price').textContent = product.price;
    document.getElementById('checkout-error').hidden = true;
    const variationField = document.getElementById('checkout-variation-field');
    const select = document.getElementById('checkout-variation');
    variationField.hidden = product.type !== 'variable';
    select.disabled = product.type !== 'variable';
    select.required = product.type === 'variable';
    select.replaceChildren(...product.variations.map((v) => { const option = document.createElement('option'); option.value = v.key; option.textContent = `${v.label} — ${v.price}`; option.disabled = v.available === 0; return option; }));
    select.value = variationKey || product.selectedVariation;
    if (select.selectedOptions[0]?.disabled) select.value = product.variations.find((v) => v.available !== 0)?.key || '';
    const update = () => {
      const v = product.variations.find((row) => row.key === select.value);
      document.getElementById('checkout-price').textContent = v?.price || product.price;
      form.elements.quantity.max = String(Math.max(1, Math.min(99, (product.type === 'variable' ? v?.available : product.stock) ?? 99)));
      if (Number(form.elements.quantity.value) > Number(form.elements.quantity.max)) form.elements.quantity.value = form.elements.quantity.max;
    };
    select.onchange = update; update();
    paymentMethods(data.paymentMethods);
    form.querySelector('[type="submit"]').disabled = data.demo || submitting;
    form.querySelector('[type="submit"]').textContent = data.demo ? t.demoCheckout : t.submit;
    if (detail.open) detail.close();
    checkout.showModal(); document.body.classList.add('has-dialog');
    form.elements.name.focus({ preventScroll: true });
  }
  document.addEventListener('click', (event) => {
    const buy = event.target.closest('[data-action="cart"], [data-buy-index]');
    if (!buy) return;
    const index = Number(buy.dataset.index ?? buy.dataset.buyIndex);
    openCheckout(index, buy, buy.dataset.variation);
  });
  $('.detail__cta').addEventListener('click', () => {
    const p = products[activeIndex];
    if (!p) return;
    if (p.externalUrl) { window.location.assign(p.externalUrl); return; }
    if (p.type === 'grouped' && p.grouped[0]) { window.location.assign(p.grouped[0].href); return; }
    openCheckout(activeIndex, $('.detail__cta'), currentVariation()?.key);
  });
  const productPageVariation = document.getElementById('product-page-variation');
  productPageVariation?.addEventListener('change', () => {
    const p = products[0]; const variation = p?.variations.find((v) => v.key === productPageVariation.value);
    if (variation) {
      document.querySelector('.product-page__price').textContent = variation.price;
      const buy = document.querySelector('[data-buy-index="0"]');
      if (buy) { buy.dataset.variation = variation.key; buy.disabled = variation.available === 0; buy.textContent = variation.available === 0 ? t.soldOut : t.order; }
    }
  });
  function closeCheckout() { if (!submitting) checkout.close(); }
  checkout.querySelector('.checkout__close').addEventListener('click', closeCheckout);
  checkout.addEventListener('cancel', (event) => { event.preventDefault(); closeCheckout(); });
  checkout.addEventListener('click', (event) => { if (event.target === checkout) closeCheckout(); });
  checkout.addEventListener('close', () => {
    document.body.classList.remove('has-dialog');
    if (checkoutTrigger?.isConnected) checkoutTrigger.focus({ preventScroll: true });
  });
  function showError(message) {
    const error = document.getElementById('checkout-error'); error.textContent = message || t.error; error.hidden = false;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || data.demo || !form.reportValidity()) return;
    const product = products[activeIndex];
    if (!product) return;
    const fields = new FormData(form);
    const text = (name) => String(fields.get(name) || '').trim();
    const body = {
      product: product.id, quantity: Number(text('quantity')), name: text('name'), phone: text('phone'), company: text('company'),
      ...(product.type === 'variable' ? { variation: text('variation') } : {}),
      ...(text('couponCode') ? { couponCode: text('couponCode') } : {}),
      ...(text('email') ? { email: text('email') } : {}),
      ...(text('note') ? { note: text('note') } : {}),
      ...(text('gateway') ? { gateway: text('gateway') } : {}),
    };
    submitting = true;
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = t.sending;
    checkout.querySelector('.checkout__close').disabled = true;
    form.setAttribute('aria-busy', 'true');
    document.getElementById('checkout-error').hidden = true;
    try {
      // Relative, same-origin: the proxy preserves Host for this visitor write.
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit' });
      const result = await response.json().catch(() => null);
      if (!response.ok && Array.isArray(result?.methods)) paymentMethods(result.methods);
      const target = result?.redirectUrl || result?.confirmationUrl;
      if (result?.ok === true && typeof target === 'string' && target) {
        const url = new URL(target, location.origin);
        const localPath = url.origin === location.origin ? url.pathname.replace(/^\/+/, '/') : null;
        const receiptPath = localPath?.replace(/^\/(fa|en)(?=\/)/, '') || '';
        if (url.origin === location.origin && (receiptPath === '/checkout' || receiptPath.startsWith('/checkout/'))) {
          window.location.assign(url.pathname + url.search); return;
        }
        if (url.origin !== location.origin && url.protocol === 'https:') { window.location.assign(url.href); return; }
        showError(t.error);
      } else {
        showError(result?.message || (response.status === 429 ? (data.locale === 'fa' ? 'کمی صبر کنید و دوباره تلاش کنید.' : 'Please wait a moment and try again.') : t.error));
      }
    } catch { showError(t.error); }
    finally {
      submitting = false; submit.disabled = false; submit.textContent = t.submit;
      checkout.querySelector('.checkout__close').disabled = false;
      form.removeAttribute('aria-busy');
    }
  });

  // Native dialogs already trap focus. Handle the optional focus return explicitly
  // rather than installing a document-wide trap that can steal checkout focus.
  document.querySelectorAll('.cms-form').forEach((cmsForm) => {
    cmsForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (data.demo) { cmsForm.querySelector('.form-status').textContent = t.demoCheckout; return; }
      if (!cmsForm.reportValidity()) return;
      const button = cmsForm.querySelector('[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
      const status = cmsForm.querySelector('.form-status'); status.textContent = t.sending;
      const fields = new FormData(cmsForm);
      const submissionData = [...new Set(fields.keys())].map((field) => ({ field, value: fields.getAll(field).length > 1 ? fields.getAll(field) : fields.get(field) }));
      try {
        const response = await fetch('/api/form-submissions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ form: cmsForm.dataset.formId, submissionData }), credentials: 'omit' });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.message || t.error);
        const confirmation = cmsForm.querySelector('template[data-confirmation]');
        status.replaceChildren(confirmation ? confirmation.content.cloneNode(true) : document.createTextNode(t.formSuccess));
        cmsForm.reset();
        if (cmsForm.dataset.confirmationType === 'redirect' && cmsForm.dataset.redirect) window.location.assign(cmsForm.dataset.redirect);
      } catch (error) { status.textContent = error.message || t.error; }
      finally { button.disabled = false; }
    });
  });
})();
