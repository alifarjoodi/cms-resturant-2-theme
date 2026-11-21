/**
 * Café menu rules, mirrored from the CMS (`src/lib/cafe-menu.ts`).
 *
 * The preview in this theme is never authoritative: checkout re-reads every
 * product and re-validates availability and modifiers. These helpers exist so
 * the *rendered* menu and the cart agree with what checkout will accept — a
 * "ناموجود" chip on a sold-out drink, a required group the buyer cannot skip,
 * and an option the POS retired all have to be decided the same way in both
 * places, or the buyer is told one thing and refused another.
 */

/** One group's `maxSelections` ceiling. `999` is a POS's word for "no limit". */
export const MAX_MENU_SELECTIONS = 999;

/**
 * A table QR's token, as the CMS accepts it (`src/lib/cafe-order.ts`). Anything
 * else in `?t=` is dropped rather than forwarded, so a link someone edited does
 * not put a service mode on the order.
 */
export const TABLE_TOKEN_PATTERN = /^[A-Za-z0-9._~:/+-]{8,512}$/;
export const isTableToken = (value) => typeof value === 'string' && TABLE_TOKEN_PATTERN.test(value);

/** How many products one menu block may render. */
export const MENU_LIMIT_MAX = 100;

const asInt = (value) => (Number.isSafeInteger(value) ? value : null);

/** `available` | `sold_out` | `unavailable`, exactly as checkout decides it. */export function menuState(product) {
  if (!product || typeof product !== 'object') return 'unavailable';
  if (product.menuAvailability === 'sold_out') return 'sold_out';
  if (product.menuAvailability && product.menuAvailability !== 'available') return 'unavailable';
  // A tracked-but-missing projection is not evidence of unlimited stock.
  if (product.trackInventory) {
    const inventory = asInt(product.inventory);
    if (inventory === null || inventory < 0) return 'unavailable';
    if (inventory === 0) return 'sold_out';
  }
  return 'available';
}

/** Stable order: accounting order first, then the source identity. */
export function menuSort(items) {
  return [...items].sort((a, b) => {
    const byOrder = (a.menuOrder ?? 0) - (b.menuOrder ?? 0);
    if (byOrder) return byOrder;
    const left = String(a.menuSourceId ?? a.sourceId ?? a.id ?? '');
    const right = String(b.menuSourceId ?? b.sourceId ?? b.id ?? '');
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

/**
 * The category a card belongs to, and the order that category holds in the POS.
 * `terms` arrive as depth-1 documents; a word that is not the café taxonomy is
 * ignored because its `menuOrder` means something else entirely.
 */
export function categoryOf(product) {
  const terms = (product?.terms ?? []).filter((term) => typeof term === 'object' && term);
  const menuTerm = terms.find((term) => term.menuSourceSystem) ?? terms[0];
  if (!menuTerm) return { name: '', order: 0, id: '' };
  return { name: menuTerm.name || '', order: asInt(menuTerm.menuOrder) ?? 0, id: String(menuTerm.id ?? '') };
}

/** Category order, then the item's own order — how a printed menu reads. */
export function menuGroupsFor(products) {
  return [...products].sort((a, b) => {
    const left = categoryOf(a);
    const right = categoryOf(b);
    if (left.order !== right.order) return left.order - right.order;
    if (left.name !== right.name) return left.name.localeCompare(right.name, 'fa');
    const byItemOrder = (a.menuOrder ?? 0) - (b.menuOrder ?? 0);
    if (byItemOrder) return byItemOrder;
    return String(a.menuSourceId ?? a.id ?? '').localeCompare(String(b.menuSourceId ?? b.id ?? ''));
  });
}

/**
 * The add-ons a buyer may choose, with the retired ones removed and the bounds
 * made real: a group can never accept more choices than it has options, and a
 * "select one of these" group whose options were all retired is not a group.
 */
export function activeModifierGroups(product) {
  const groups = [];
  for (const raw of product?.modifierGroups ?? []) {
    if (!raw || typeof raw !== 'object' || raw.active === false) continue;
    if (typeof raw.sourceId !== 'string' || !raw.sourceId) continue;
    const options = (raw.options ?? [])
      .filter((option) => option && typeof option === 'object' && option.active !== false)
      .filter((option) => typeof option.sourceId === 'string' && option.sourceId && typeof option.label === 'string' && option.label)
      .filter((option) => Number.isSafeInteger(option.priceDelta))
      .sort((a, b) => (a.menuOrder ?? 0) - (b.menuOrder ?? 0) || String(a.sourceId).localeCompare(String(b.sourceId)));
    if (!options.length) continue;
    if (typeof raw.label !== 'string' || !raw.label) continue;
    const max = Math.min(Math.max(asInt(raw.maxSelections) ?? 1, 1), options.length, MAX_MENU_SELECTIONS);
    const min = Math.min(Math.max(asInt(raw.minSelections) ?? 0, 0), max);
    groups.push({
      sourceId: raw.sourceId,
      label: raw.label,
      minSelections: min,
      maxSelections: max,
      menuOrder: asInt(raw.menuOrder) ?? 0,
      options: options.map((option) => ({
        sourceId: option.sourceId,
        label: option.label,
        priceDelta: option.priceDelta,
        menuOrder: asInt(option.menuOrder) ?? 0,
      })),
    });
  }
  return groups.sort((a, b) => a.menuOrder - b.menuOrder || a.sourceId.localeCompare(b.sourceId));
}

/**
 * Is this product ordered through the cart rather than the one-product form?
 * A POS-managed item always is: its add-ons are part of what it costs, and the
 * cart is the only request the CMS prices them from.
 */
export function needsCart(product) {
  return Boolean(product?.menuSourceSystem) || activeModifierGroups(product).length > 0;
}

/** Minor-unit sum of a selection, for the preview only — checkout re-prices it. */
export function selectionDelta(groups, selection) {
  let delta = 0;
  for (const group of groups) {
    const chosen = selection?.[group.sourceId];
    const ids = Array.isArray(chosen) ? chosen : [];
    for (const id of ids) {
      const option = group.options.find((candidate) => candidate.sourceId === id);
      if (option) delta += option.priceDelta;
    }
  }
  return delta;
}

/**
 * Every rule a group imposes, as a message key plus the group it belongs to.
 * The buyer sees "pick one of these"; the submit button stays disabled until
 * it is true, so a request the CMS would refuse is never sent.
 */
export function selectionProblems(groups, selection) {
  const problems = [];
  for (const group of groups) {
    const chosen = selection?.[group.sourceId];
    const count = Array.isArray(chosen) ? chosen.length : 0;
    if (count < group.minSelections) problems.push({ group, kind: 'min' });
    else if (count > group.maxSelections) problems.push({ group, kind: 'max' });
  }
  return problems;
}
