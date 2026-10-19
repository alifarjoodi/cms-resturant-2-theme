/* Coffee Shop — hover affordances live in CSS; this file powers the glass detail panel. */
(() => {
  'use strict';

  const dialog = document.getElementById('item-detail');
  if (!dialog) return;

  const items = Array.from(document.querySelectorAll('.menu-grid .item'));
  if (!items.length) return;

  const els = {
    name: dialog.querySelector('#detail-name'),
    desc: dialog.querySelector('#detail-desc'),
    num: dialog.querySelector('.detail__num'),
    cat: dialog.querySelector('.detail__cat'),
    notes: dialog.querySelector('.detail__notes'),
    dots: dialog.querySelector('.detail__dots'),
    price: dialog.querySelector('.detail__price-amount'),
    volume: dialog.querySelector('[data-field="volume"]'),
    temp: dialog.querySelector('[data-field="temp"]'),
    stage: dialog.querySelector('.detail__stage'),
    ghost: dialog.querySelector('.detail__ghost'),
    cta: dialog.querySelector('.detail__cta'),
    ctaLabel: dialog.querySelector('.detail__cta > span'),
    status: dialog.querySelector('[role="status"]'),
    close: dialog.querySelector('.detail__close'),
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let activeItem = null;
  let closing = false;
  let closeTimer = 0;
  let ctaTimer = 0;

  const fill = (item) => {
    const data = item.dataset;

    els.name.textContent = data.name || 'Coffee';
    els.desc.textContent = data.desc || '';
    els.num.textContent = `N° ${data.num || '01'}`;
    els.cat.textContent = data.category || '';
    els.price.textContent = data.price || '$5';
    els.volume.textContent = data.volume || '—';
    els.temp.textContent = data.temp || '—';
    els.ghost.textContent = data.num || '01';

    const notes = (data.notes || '')
      .split('|')
      .map((note) => note.trim())
      .filter(Boolean);

    els.notes.replaceChildren(
      ...notes.map((note) => {
        const li = document.createElement('li');
        li.textContent = note;
        return li;
      }),
    );
    els.notes.setAttribute(
      'aria-label',
      notes.length ? `Flavor notes: ${notes.join(', ')}` : 'Flavor notes',
    );

    const intensity = Math.min(5, Math.max(1, Number.parseInt(data.intensity, 10) || 3));
    els.dots.replaceChildren(
      ...Array.from({ length: 5 }, (_, index) => {
        const dot = document.createElement('span');
        dot.className = index < intensity ? 'dot is-on' : 'dot';
        dot.setAttribute('aria-hidden', 'true');
        return dot;
      }),
    );
    els.dots.setAttribute('aria-label', `Intensity ${intensity} out of 5`);

    /* Reuse the exact cup artwork of the selected drink, scaled up. */
    const cup = item.querySelector('.cup');
    if (cup) {
      els.stage.replaceChildren(cup.cloneNode(true));
    } else {
      els.stage.replaceChildren();
    }

    window.clearTimeout(ctaTimer);
    els.cta.classList.remove('is-added');
    els.ctaLabel.textContent = 'Add to order';
    els.status.textContent = '';
  };

  const open = (item) => {
    if (closing) {
      window.clearTimeout(closeTimer);
      closing = false;
      dialog.classList.remove('is-closing');
    }

    activeItem = item;
    fill(item);

    if (!dialog.open) dialog.showModal();
    document.body.classList.add('has-detail');

    els.close.focus({ preventScroll: true });
  };

  const close = () => {
    if (!dialog.open || closing) return;

    closing = true;
    dialog.classList.add('is-closing');

    closeTimer = window.setTimeout(
      () => {
        if (dialog.open) dialog.close();
      },
      reduceMotion.matches ? 230 : 580,
    );
  };

  items.forEach((item) => {
    item.addEventListener('click', () => open(item));

    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        open(item);
      }
    });
  });

  els.close.addEventListener('click', close);

  /* Keep Tab (and Shift+Tab) cycling inside the glass while it is open. */
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !dialog.open) return;

    const focusables = Array.from(dialog.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.disabled && element.getClientRects().length > 0);
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    const outside = !dialog.contains(active) || active === document.body;

    if (event.shiftKey && (outside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (outside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  });

  /* A click on the dimmed backdrop (the dialog itself) folds the glass away. */
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  /* Escape gets the same fold-out instead of an instant disappear. */
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  dialog.addEventListener('close', () => {
    /* A delayed close event can land after the glass was reopened: ignore it. */
    if (dialog.open) return;

    window.clearTimeout(closeTimer);
    window.clearTimeout(ctaTimer);
    closing = false;
    dialog.classList.remove('is-closing');
    document.body.classList.remove('has-detail');

    const returnTo = activeItem;
    activeItem = null;
    if (returnTo) returnTo.focus({ preventScroll: true });
  });

  els.cta.addEventListener('click', () => {
    const name = activeItem ? activeItem.dataset.name || 'Coffee' : els.name.textContent;

    window.clearTimeout(ctaTimer);
    els.cta.classList.remove('is-added');
    void els.cta.offsetWidth;
    els.cta.classList.add('is-added');
    els.ctaLabel.textContent = 'Added to order';
    els.status.textContent = `${name} added to your order.`;

    ctaTimer = window.setTimeout(() => {
      els.cta.classList.remove('is-added');
      els.ctaLabel.textContent = 'Add to order';
      els.status.textContent = '';
    }, 2400);
  });
})();
