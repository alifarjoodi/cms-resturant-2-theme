/* Poster interactions, plus two checkouts that share one dialog:
 *
 * - a plain store sends one product (`{product, quantity, …}`), which is the
 *   legacy request and the only one coupons work on;
 * - a café sends a cart (`{items:[{product, quantity, modifiers}], …}`), which
 *   is the only request that can price add-ons, and carries the service mode and
 *   the pay-at-counter choice.
 *
 * No price, stock, availability or modifier rule is decided here: the cart is a
 * preview, the CMS re-reads every line and re-validates every choice. Nothing in
 * this file may set a paid status or a total the server did not compute. */
(() => {
  'use strict';
  const dataNode = document.getElementById('theme-data');
  if (!dataNode) return;
  const data = JSON.parse(dataNode.textContent);
  const products = data.products || [];
  const t = data.strings;
  const money = window.eshobeMoney;
  const cafe = Boolean(data.cafe);
  const currency = data.currency;
  const locale = data.locale;
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
  let cartTrigger = null;
  let checkoutMode = 'single';
  const $ = (selector) => detail.querySelector(selector);
  const setText = (selector, value) => { $(selector).textContent = value || ''; };

  /* ----------------------------- money preview ---------------------------- */
  const price = (minor) => (money && money.isCurrency(currency) ? money.formatPrice(minor, currency, locale) : String(minor));
  const delta = (minor) => (money ? money.formatDelta(minor, currency, locale) : '');

  /* -------------------------------- favourites ---------------------------- */
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

  /* ------------------------------- the cart ------------------------------- */
  // In-memory only, like the CMS's own café menu: a cart that outlived a reload
  // on a table's shared phone would order somebody else's drink.
  const cart = new Map();
  let pendingRequestId = null;
  let pendingSignature = null;
  let detailSelection = {};
  let detailQuantity = 1;

  const signatureOf = (index, selection) => {
    const product = products[index];
    if (!product) return '';
    const parts = (product.modifiers || []).map((group) => `${group.sourceId}:${(selection[group.sourceId] || []).slice().sort().join(',')}`);
    return `${product.id}|${parts.join('|')}`;
  };
  const cartCount = () => [...cart.values()].reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = () => [...cart.values()].reduce((sum, line) => sum + line.unitMinor * line.quantity, 0);
  function modifierSnapshot(product, selection) {
    return (product.modifiers || []).flatMap((group) => {
      const ids = selection[group.sourceId] || [];
      return ids.length ? [{ groupId: group.sourceId, optionIds: ids.slice() }] : [];
    });
  }
  function selectionDelta(product, selection) {
    let sum = 0;
    for (const group of product.modifiers || []) {
      for (const id of selection[group.sourceId] || []) {
        const option = group.options.find((candidate) => candidate.sourceId === id);
        if (option) sum += option.priceDelta;
      }
    }
    return sum;
  }
  function selectionComplete(product, selection) {
    return (product.modifiers || []).every((group) => (selection[group.sourceId] || []).length >= group.minSelections);
  }
  function resetRequestId() { pendingRequestId = null; pendingSignature = null; }
  function randomId() {
    try {
      if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      if (globalThis.crypto && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
        return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch { /* fall through */ }
    return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
  function addToCart(index, quantity, selection) {
    const product = products[index];
    if (!product || !selectionComplete(product, selection)) return false;
    const modifiers = modifierSnapshot(product, selection);
    const key = signatureOf(index, selection);
    const unitMinor = (product.priceMinor || 0) + selectionDelta(product, selection);
    const existing = cart.get(key);
    if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
    else cart.set(key, { key, index, productId: product.id, title: product.title, quantity, unitMinor, modifiers, selection: JSON.parse(JSON.stringify(selection)) });
    resetRequestId();
    renderCart();
    return true;
  }
  function setQuantity(key, quantity) {
    const line = cart.get(key);
    if (!line) return;
    const next = Math.max(0, Math.min(99, quantity));
    if (next === 0) cart.delete(key); else line.quantity = next;
    resetRequestId();
    renderCart();
  }
  function renderCartBar() {
    const bar = document.getElementById('cart-bar');
    if (!bar) return;
    const count = cartCount();
    bar.hidden = count === 0;
    const countNode = document.getElementById('cart-count');
    const totalNode = document.getElementById('cart-total');
    if (countNode) countNode.textContent = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : locale).format(count);
    if (totalNode) totalNode.textContent = price(cartTotal());
  }
  function renderCartLines() {
    const list = document.getElementById('cart-lines');
    if (!list) return;
    list.hidden = cart.size === 0;
    list.replaceChildren(...[...cart.values()].map((line) => {
      const item = document.createElement('li');
      item.className = 'cart-line';
      item.dataset.key = line.key;
      const body = document.createElement('div');
      body.className = 'cart-line__body';
      const title = document.createElement('strong');
      title.className = 'cart-line__title';
      title.textContent = line.title;
      body.append(title);
      const choice = (line.modifiers || []).map((modifier) => {
        const group = (products[line.index]?.modifiers || []).find((candidate) => candidate.sourceId === modifier.groupId);
        const labels = modifier.optionIds.map((id) => group?.options.find((option) => option.sourceId === id)?.label).filter(Boolean);
        return labels.join('، ');
      }).filter(Boolean).join(' · ');
      if (choice) { const span = document.createElement('span'); span.className = 'cart-line__choice'; span.textContent = choice; body.append(span); }
      const stepper = document.createElement('div');
      stepper.className = 'cart-line__qty';
      const fewer = document.createElement('button');
      fewer.type = 'button'; fewer.dataset.cartStep = '-1'; fewer.textContent = '−'; fewer.setAttribute('aria-label', `${t.fewer}: ${line.title}`);
      const value = document.createElement('output');
      value.textContent = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : locale).format(line.quantity);
      const more = document.createElement('button');
      more.type = 'button'; more.dataset.cartStep = '1'; more.textContent = '+'; more.setAttribute('aria-label', `${t.more}: ${line.title}`);
      stepper.append(fewer, value, more);
      const total = document.createElement('span');
      total.className = 'cart-line__total';
      total.textContent = price(line.unitMinor * line.quantity);
      item.append(body, stepper, total);
      return item;
    }));
  }
  function renderCart() {
    renderCartBar();
    if (checkout.open && checkoutMode === 'cart') {
      renderCartLines();
      renderCartSummary();
    } else renderCartLines();
  }
  document.addEventListener('click', (event) => {
    const step = event.target.closest('[data-cart-step]');
    if (!step) return;
    const key = step.closest('.cart-line')?.dataset.key;
    const line = key ? cart.get(key) : null;
    if (!line) return;
    setQuantity(key, line.quantity + Number(step.dataset.cartStep));
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-action="open-cart"]')) return;
    openCart(event.target.closest('[data-action="open-cart"]'));
  });
  renderCart();

  /* --------------------------- add-ons in the sheet ----------------------- */
  function renderModifiers(product) {
    const container = $('#detail-modifiers');
    const groups = product.modifiers || [];
    container.hidden = !groups.length;
    detailSelection = {};
    container.replaceChildren(...groups.map((group) => {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'modifier';
      fieldset.dataset.group = group.sourceId;
      const legend = document.createElement('legend');
      legend.textContent = group.label;
      const hint = document.createElement('span');
      hint.className = 'modifier__hint';
      hint.textContent = group.maxSelections === 1 ? t.chooseOne : t.chooseAny;
      if (group.minSelections > 0) {
        const required = document.createElement('span');
        required.className = 'modifier__required';
        required.textContent = t.required;
        legend.append(' ', required);
      }
      legend.append(' ', hint);
      fieldset.append(legend);
      const single = group.maxSelections === 1 && group.minSelections >= 1;
      group.options.forEach((option) => {
        const label = document.createElement('label');
        label.className = 'modifier__option';
        const input = document.createElement('input');
        input.type = single ? 'radio' : 'checkbox';
        input.name = `modifier-${group.sourceId}`;
        input.value = option.sourceId;
        const text = document.createElement('span');
        text.className = 'modifier__label';
        text.textContent = option.label;
        label.append(input, text);
        if (option.priceLabel) {
          const add = document.createElement('span');
          add.className = 'modifier__delta';
          add.textContent = option.priceLabel;
          label.append(add);
        }
        fieldset.append(label);
      });
      return fieldset;
    }));
    detailSelection = {};
    for (const group of groups) detailSelection[group.sourceId] = [];
  }
  function selectionFromDetail() {
    const selection = {};
    for (const group of products[activeIndex]?.modifiers || []) {
      selection[group.sourceId] = [...detail.querySelectorAll(`input[name="modifier-${CSS.escape(group.sourceId)}"]:checked`)].map((input) => input.value);
    }
    return selection;
  }
  function syncModifierLimits() {
    const product = products[activeIndex];
    if (!product) return;
    for (const group of product.modifiers || []) {
      const inputs = [...detail.querySelectorAll(`input[name="modifier-${CSS.escape(group.sourceId)}"]`)];
      const checked = inputs.filter((input) => input.checked).length;
      for (const input of inputs) {
        if (input.type === 'checkbox' && group.maxSelections > 1) input.disabled = !input.checked && checked >= group.maxSelections;
      }
    }
  }
  detail.addEventListener('change', (event) => {
    const input = event.target.closest('.modifier input');
    if (!input) return;
    detailSelection = selectionFromDetail();
    syncModifierLimits();
    const product = products[activeIndex];
    const error = $('.detail__modifier-error');
    const problems = (product?.modifiers || []).filter((group) => (detailSelection[group.sourceId] || []).length < group.minSelections);
    error.hidden = !problems.length;
    error.textContent = problems.length ? `${t.modifierRequired} (${problems.map((group) => group.label).join(' · ')})` : '';
    updateVariation();
  });

  /* ------------------------------- detail sheet --------------------------- */
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
    const base = product.type === 'variable' && variation ? (product.priceMinor || 0) : (product.priceMinor || 0);
    const withAddons = base + selectionDelta(product, detailSelection);
    const label = product.usesCart || product.modifiers.length ? price(withAddons * detailQuantity) : (variation?.price || product.price);
    setText('.detail__price-amount', label);
    $('.detail__compare').hidden = !product.compareAt || product.type === 'variable' || Boolean(product.modifiers.length);
    setText('.detail__compare', product.compareAt);
    const complete = selectionComplete(product, detailSelection);
    $('.detail__cta').disabled = !product.canBuy || stock === 0 || (product.usesCart && !complete);
    $('.detail__cta > span').textContent = stock === 0 ? t.soldOut : product.externalUrl ? (product.buttonText || t.external) : product.usesCart ? t.addToOrder : t.order;
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
    detailQuantity = 1;
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
    renderModifiers(p);
    $('#detail-qty').hidden = !p.usesCart;
    $('#detail-quantity').textContent = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : locale).format(detailQuantity);
    $('.detail__modifier-error').hidden = true;
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
  function closeDetail(immediate = false) {
    if (!detail.open || closing) return;
    if (immediate) { detail.close(); return; }
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
  detail.addEventListener('click', (event) => {
    const step = event.target.closest('#detail-qty [data-step]');
    if (!step) return;
    detailQuantity = Math.max(1, Math.min(99, detailQuantity + Number(step.dataset.step)));
    $('#detail-quantity').textContent = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : locale).format(detailQuantity);
    updateVariation();
  });

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

  /* ------------------------------ the checkout ---------------------------- */
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
  function radio(name, value, labelText, checked) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio'; input.name = name; input.value = value; input.checked = Boolean(checked);
    const text = document.createElement('span'); text.textContent = labelText;
    label.append(input, text);
    return label;
  }
  function renderServiceModes() {
    const fieldset = document.getElementById('checkout-service');
    const container = document.getElementById('service-modes');
    const hasTable = Boolean(data.tableToken);
    fieldset.hidden = false;
    container.replaceChildren(
      radio('serviceMode', 'dine_in', hasTable ? `${t.dineIn} — ${t.tableLabel}` : `${t.dineIn} · ${t.tableHint}`, hasTable),
      radio('serviceMode', 'takeaway', t.takeaway, !hasTable),
    );
    container.querySelectorAll('input[value="dine_in"]').forEach((input) => { input.disabled = !hasTable; });
  }
  function renderPaymentChoices() {
    const fieldset = document.getElementById('checkout-payment-choice');
    const container = document.getElementById('payment-choices');
    const methods = Array.isArray(data.paymentMethods) ? data.paymentMethods : [];
    const online = methods.length > 0;
    fieldset.hidden = false;
    container.replaceChildren(
      radio('paymentChoice', 'counter', t.payAtCounter, true),
      ...(online ? [radio('paymentChoice', 'online', t.payOnline, false)] : []),
    );
    paymentMethods(online ? methods : []);
    document.getElementById('payment-methods').closest('fieldset').hidden = true;
  }
  document.getElementById('payment-choices').addEventListener('change', (event) => {
    if (!event.target.closest('input[name="paymentChoice"]')) return;
    const onlineChosen = Boolean(document.querySelector('#payment-choices input[value="online"]:checked'));
    document.getElementById('payment-methods').closest('fieldset').hidden = !onlineChosen;
  });
  function renderCartSummary() {
    const node = document.getElementById('checkout-price');
    if (node) node.textContent = price(cartTotal());
    const countNode = document.getElementById('checkout-product');
    if (countNode) countNode.textContent = `${new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : locale).format(cartCount())} ${t.itemCount}`;
  }
  function openCart(trigger) {
    if (!cart.size) return;
    cartTrigger = trigger;
    checkoutMode = 'cart';
    form.reset();
    renderCartLines();
    renderCartSummary();
    document.getElementById('checkout-error').hidden = true;
    document.getElementById('checkout-variation-field').hidden = true;
    document.getElementById('checkout-variation').disabled = true;
    document.getElementById('checkout-quantity-field').hidden = true;
    form.elements.quantity.disabled = true;
    form.elements.quantity.required = false;
    document.getElementById('checkout-coupon-field').hidden = true;
    form.elements.couponCode.disabled = true;
    renderServiceModes();
    renderPaymentChoices();
    form.querySelector('[type="submit"]').disabled = data.demo || submitting;
    form.querySelector('[type="submit"]').textContent = data.demo ? t.demoCheckout : t.submit;
    checkout.showModal(); document.body.classList.add('has-dialog');
    form.elements.name.focus({ preventScroll: true });
  }
  function syncCartTotals() {
    // A line edit while the sheet is open must not leave a stale total on screen.
    renderCartLines();
    renderCartSummary();
  }
  function openCheckout(index, trigger, variationKey) {
    const product = products[index];
    if (!product) return;
    if (cafe) { openDetail(index, trigger); return; }
    checkoutMode = 'single';
    activeIndex = index; checkoutTrigger = trigger;
    form.reset();
    document.getElementById('cart-lines').hidden = true;
    document.getElementById('checkout-service').hidden = true;
    document.getElementById('checkout-payment-choice').hidden = true;
    document.getElementById('checkout-variation-field').hidden = product.type !== 'variable';
    document.getElementById('checkout-quantity-field').hidden = false;
    form.elements.quantity.disabled = false;
    form.elements.quantity.required = true;
    form.elements.quantity.value = '1';
    form.elements.quantity.max = String(Math.min(99, product.stock ?? 99));
    document.getElementById('checkout-coupon-field').hidden = false;
    form.elements.couponCode.disabled = false;
    document.getElementById('checkout-product').textContent = product.title;
    document.getElementById('checkout-price').textContent = product.price;
    document.getElementById('checkout-error').hidden = true;
    const select = document.getElementById('checkout-variation');
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
    if (cafe) { openDetail(index, buy); return; }
    openCheckout(index, buy, buy.dataset.variation);
  });
  $('.detail__cta').addEventListener('click', () => {
    const p = products[activeIndex];
    if (!p) return;
    if (p.externalUrl) { window.location.assign(p.externalUrl); return; }
    if (p.type === 'grouped' && p.grouped[0]) { window.location.assign(p.grouped[0].href); return; }
    if (!cafe || !p.usesCart) { openCheckout(activeIndex, $('.detail__cta'), currentVariation()?.key); return; }
    const selection = selectionFromDetail();
    if (!addToCart(activeIndex, detailQuantity, selection)) return;
    // Two modals at once reads as a broken page: the sheet is replaced, not stacked.
    closeDetail(true);
    const cta = $('.detail__cta');
    cta.classList.add('is-added');
    setTimeout(() => cta.classList.remove('is-added'), 900);
    openCart($('.detail__cta'));
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
    else if (cartTrigger?.isConnected) cartTrigger.focus({ preventScroll: true });
  });
  function showError(message) {
    const error = document.getElementById('checkout-error'); error.textContent = message || t.error; error.hidden = false;
  }
  function cartBody() {
    const fields = new FormData(form);
    const text = (name) => String(fields.get(name) || '').trim();
    const serviceMode = text('serviceMode') || 'takeaway';
    const paymentChoice = text('paymentChoice') || 'counter';
    const gateway = text('gateway');
    return {
      items: [...cart.values()].map((line) => ({
        product: line.productId,
        quantity: line.quantity,
        ...(line.modifiers.length ? { modifiers: line.modifiers } : {}),
      })),
      name: text('name'), phone: text('phone'), company: text('company'),
      checkoutRequestId: pendingRequestId,
      serviceMode,
      ...(serviceMode === 'dine_in' && data.tableToken ? { tableToken: data.tableToken } : {}),
      paymentChoice,
      ...(paymentChoice === 'online' && gateway ? { gateway } : {}),
      locale,
      ...(text('email') ? { email: text('email') } : {}),
      ...(text('note') ? { note: text('note') } : {}),
    };
  }
  function legacyBody(product) {
    const fields = new FormData(form);
    const text = (name) => String(fields.get(name) || '').trim();
    return {
      product: product.id, quantity: Number(text('quantity')), name: text('name'), phone: text('phone'), company: text('company'),
      ...(product.type === 'variable' ? { variation: text('variation') } : {}),
      ...(text('couponCode') ? { couponCode: text('couponCode') } : {}),
      ...(text('email') ? { email: text('email') } : {}),
      ...(text('note') ? { note: text('note') } : {}),
      ...(text('gateway') ? { gateway: text('gateway') } : {}),
    };
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || data.demo || !form.reportValidity()) return;
    const useCart = checkoutMode === 'cart' && cart.size > 0;
    const product = products[activeIndex];
    if (!useCart && !product) return;
    if (useCart) {
      // The id belongs to this basket: a retry of the same basket is the same
      // order (the CMS answers with the first one), a different basket must be a
      // different id or the CMS refuses it as a 409.
      const signature = [...cart.values()].map((line) => `${line.key}x${line.quantity}`).sort().join(';');
      if (!pendingRequestId || pendingSignature !== signature) {
        pendingRequestId = randomId();
        pendingSignature = signature;
      }
    }
    const body = useCart ? cartBody() : legacyBody(product);
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
        if (useCart) { cart.clear(); renderCart(); resetRequestId(); }
        const url = new URL(target, location.origin);
        const localPath = url.origin === location.origin ? url.pathname.replace(/^\/+/, '/') : null;
        const receiptPath = localPath?.replace(/^\/(fa|en)(?=\/)/, '') || '';
        if (url.origin === location.origin && (receiptPath === '/checkout' || receiptPath.startsWith('/checkout/'))) {
          window.location.assign(url.pathname + url.search); return;
        }
        if (url.origin !== location.origin && url.protocol === 'https:') { window.location.assign(url.href); return; }
        showError(t.error);
      } else if (result?.ok === true) {
        // A 200 with nothing to show is not an order. The CMS answers exactly this
        // shape when its honeypot fires (`{ok:true, message:'ثبت شد.'}`), and
        // echoing that message is how a buyer is told "registered" for an order
        // that was never written. Keep the sheet open so it can be retried.
        console.warn('checkout: ok response without a receipt target', typeof result?.message === 'string' ? result.message.slice(0, 120) : '');
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
