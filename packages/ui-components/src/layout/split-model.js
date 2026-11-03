/**
 * The pure model of a split: the sizes of its panes as numbers (percent by
 * default) whose sum, the total, never changes. Every function returns new
 * sizes and leaves its input alone.
 *
 * Limits are `{ min, max, collapsible }`, each one value for every pane or
 * an array with one value per pane. A collapsed pane has the size 0, which
 * is allowed only for a collapsible pane; every other size stays within
 * `[min, max]`.
 */

/**
 * @typedef {object} SplitLimits
 * @property {number|number[]} [min]  default 0
 * @property {number|number[]} [max]  default the total
 * @property {boolean|boolean[]} [collapsible]  default false
 */

const EPSILON = 1e-9;

/** The value of a limit for one pane. */
function limitOf(limits, name, index, fallback) {
  const value = limits?.[name];
  const one = Array.isArray(value) ? value[index] : value;
  return one === undefined || one === null ? fallback : one;
}

/** `{ min, max, collapsible }` of one pane of a split of `total`. */
function limitsAt(total, index, limits) {
  const min = Math.max(0, limitOf(limits, 'min', index, 0));
  const max = Math.min(total, limitOf(limits, 'max', index, total));
  return {
    min,
    max: Math.max(min, max),
    collapsible: limitOf(limits, 'collapsible', index, false) === true,
  };
}

/**
 * `{ min, max, collapsible }` of one pane.
 * @param {number[]} sizes
 * @param {number} index
 * @param {SplitLimits} [limits]
 */
export const paneLimits = (sizes, index, limits = {}) =>
  limitsAt(sum(sizes), index, limits);

/** The sum of the sizes. */
export const sum = (sizes) => sizes.reduce((a, b) => a + b, 0);

const round = (value) => Math.round(value * 1e6) / 1e6;

function checkSizes(sizes, name) {
  if (
    !Array.isArray(sizes) ||
    sizes.length < 2 ||
    !sizes.every((s) => Number.isFinite(s) && s >= 0)
  ) {
    throw new TypeError(
      `${name}: sizes must be two or more non-negative numbers`
    );
  }
}

function checkIndex(index, count, name) {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError(`${name}: no pane or divider ${index}`);
  }
}

/**
 * Where the first pane of a pair may end up, given the pair's sum.
 * Collapsing (0, or the whole pair for the second pane) is added by the
 * caller.
 */
function pairBounds(a, b, pair) {
  const lo = Math.max(a.min, pair - b.max);
  const hi = Math.min(a.max, pair - b.min);
  return { lo, hi };
}

/** Snap a size of the first pane of a pair that is under a minimum. */
function snapCollapse(current, next, a, b, pair, { lo, hi }) {
  // A collapsible pane dragged (smaller) below half its minimum collapses.
  const shrinksA = next < current;
  if (
    shrinksA &&
    a.collapsible &&
    next < a.min / 2 &&
    pair <= b.max + EPSILON
  ) {
    return 0;
  }
  if (
    !shrinksA &&
    b.collapsible &&
    pair - next < b.min / 2 &&
    pair <= a.max + EPSILON
  ) {
    return pair;
  }
  if (lo > hi + EPSILON) {
    return null;
  }
  return Math.min(hi, Math.max(lo, next));
}

/**
 * Move the divider `index` (between the panes `index` and `index + 1`) by
 * `delta`: the first pane grows by `delta` and the second one shrinks by
 * the same amount, so the total stays the same. The move is clamped so
 * both panes stay within their `min` and `max`; a collapsible pane dragged
 * below half its minimum collapses to 0, and a collapsed pane dragged open
 * starts at its minimum.
 * @param {number[]} sizes
 * @param {number} index  the divider, from 0 to `sizes.length - 2`
 * @param {number} delta
 * @param {SplitLimits} [limits]
 * @returns {number[]}
 */
export function resizeSplit(sizes, index, delta, limits = {}) {
  checkSizes(sizes, 'resizeSplit');
  checkIndex(index, sizes.length - 1, 'resizeSplit');
  if (!Number.isFinite(delta)) {
    throw new TypeError('resizeSplit: delta must be a number');
  }
  const a = paneLimits(sizes, index, limits);
  const b = paneLimits(sizes, index + 1, limits);
  const pair = sizes[index] + sizes[index + 1];
  const bounds = pairBounds(a, b, pair);
  const next = snapCollapse(
    sizes[index],
    sizes[index] + delta,
    a,
    b,
    pair,
    bounds
  );
  if (next === null) {
    return [...sizes];
  }
  const result = [...sizes];
  result[index] = round(next);
  result[index + 1] = round(pair - result[index]);
  return result;
}

/** Panes ordered by their distance to `index` (the next one first). */
function neighbours(count, index) {
  const order = [];
  for (let d = 1; d < count; d += 1) {
    for (const i of [index + d, index - d]) {
      if (i >= 0 && i < count) {
        order.push(i);
      }
    }
  }
  return order;
}

/**
 * Give `rest` to the open panes nearest to `index`, each up to its `max`
 * (in place); returns what could not be given.
 */
function spread(result, index, rest, limits) {
  const total = sum(result) + rest;
  let left = rest;
  for (const i of neighbours(result.length, index)) {
    if (left <= EPSILON) {
      break;
    }
    if (result[i] === 0) {
      continue;
    }
    const room = limitsAt(total, i, limits).max - result[i];
    const given = Math.min(left, Math.max(0, room));
    result[i] = round(result[i] + given);
    left -= given;
  }
  return left;
}

/**
 * Collapse the pane `index` to 0. Its size goes to the next pane (the
 * previous one for the last pane), then to the panes further away, each up
 * to its `max`. When the other panes cannot take the space the sizes are
 * returned unchanged.
 * @param {number[]} sizes
 * @param {number} index
 * @param {SplitLimits} [limits]
 * @returns {number[]}
 */
export function collapsePane(sizes, index, limits = {}) {
  checkSizes(sizes, 'collapsePane');
  checkIndex(index, sizes.length, 'collapsePane');
  const result = [...sizes];
  result[index] = 0;
  const rest = spread(result, index, sizes[index], limits);
  return rest > EPSILON ? [...sizes] : result;
}

/**
 * Give the pane `index` the size `size` (clamped to its `min` and `max`),
 * taking the space from the nearest panes that are open, each down to its
 * `min`. A collapsed pane stays collapsed. When the others cannot give
 * even the pane's `min`, the sizes are returned unchanged.
 * @param {number[]} sizes
 * @param {number} index
 * @param {number} size
 * @param {SplitLimits} [limits]
 * @returns {number[]}
 */
export function restorePane(sizes, index, size, limits = {}) {
  checkSizes(sizes, 'restorePane');
  checkIndex(index, sizes.length, 'restorePane');
  const own = paneLimits(sizes, index, limits);
  const wanted = Math.min(own.max, Math.max(own.min, size));
  const result = [...sizes];
  let need = wanted - result[index];
  if (need <= EPSILON) {
    return resizeOwn(result, index, wanted, limits);
  }
  const order = neighbours(sizes.length, index).filter((i) => result[i] > 0);
  const spare = order.reduce(
    (total, i) => total + result[i] - paneLimits(sizes, i, limits).min,
    0
  );
  const target = result[index] + Math.min(need, spare);
  if (target < own.min - EPSILON) {
    return [...sizes];
  }
  need = target - result[index];
  for (const i of order) {
    const taken = Math.min(need, result[i] - paneLimits(sizes, i, limits).min);
    result[i] = round(result[i] - taken);
    need -= taken;
  }
  result[index] = round(target);
  return result;
}

/** Shrink a pane to `wanted`, giving the space to its neighbours. */
function resizeOwn(sizes, index, wanted, limits) {
  const result = [...sizes];
  result[index] = round(wanted);
  const rest = spread(result, index, sizes[index] - wanted, limits);
  return rest > EPSILON ? [...sizes] : result;
}

/**
 * Sizes for `count` panes: `sizes` scaled to `total` when it has one
 * non-negative number per pane and a positive sum, else equal sizes. Used
 * for remembered sizes, which may be stale or edited by hand.
 * @param {unknown} sizes
 * @param {number} count
 * @param {number} [total]
 * @returns {number[]}
 */
export function normalizeSizes(sizes, count, total = 100) {
  const valid =
    Array.isArray(sizes) &&
    sizes.length === count &&
    sizes.every((s) => typeof s === 'number' && Number.isFinite(s) && s >= 0) &&
    sum(sizes) > 0;
  if (!valid) {
    return Array.from({ length: count }, () => round(total / count));
  }
  const scale = total / sum(sizes);
  return sizes.map((s) => round(s * scale));
}
