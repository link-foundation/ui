/** Pure measured virtualization, shared with timelines and other renderers. */

/**
 * Cumulative row tops plus total height; invalid measurements use the estimate.
 * @param {{count: number, estimate: number, measured?: Map<number, number>}} input
 * @returns {Float64Array} offsets of length count + 1
 */
export function listOffsets({ count, estimate, measured = new Map() }) {
  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    !Number.isFinite(estimate) ||
    estimate <= 0
  ) {
    throw new RangeError(
      'count must be nonnegative and estimate must be positive'
    );
  }
  const offsets = new Float64Array(count + 1);
  for (let i = 0; i < count; i++) {
    const height = measured.get(i);
    offsets[i + 1] =
      offsets[i] + (Number.isFinite(height) && height > 0 ? height : estimate);
  }
  return offsets;
}

/**
 * Index containing y; -1 for an empty list. Clamps before/after the collection.
 * @param {Float64Array} offsets
 * @param {number} y
 * @returns {number}
 */
export function indexAt(offsets, y) {
  let low = 0;
  let high = offsets.length - 1;
  if (high === 0) {
    return -1;
  }
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (offsets[mid] <= y) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return Math.min(low, offsets.length - 2);
}

/**
 * Half-open rendered range, with overscan measured in viewport heights.
 * @param {Float64Array} offsets
 * @param {number} scrollTop
 * @param {number} viewportHeight
 * @param {number} [overscan]
 * @returns {{start: number, end: number}}
 */
export function listRange(offsets, scrollTop, viewportHeight, overscan = 1) {
  const count = offsets.length - 1;
  if (!count) {
    return { start: 0, end: 0 };
  }
  const height = Math.max(0, viewportHeight);
  const pad = height * Math.max(0, overscan);
  const bottom = Math.min(offsets[count], scrollTop + height + pad);
  let end = indexAt(offsets, bottom);
  if (offsets[end] < bottom) {
    end++;
  }
  return {
    start: Math.max(0, indexAt(offsets, Math.max(0, scrollTop - pad))),
    end: Math.min(count, end),
  };
}

/**
 * Keep a keyed row at its previous screen position, including intra-row offset.
 * before: {keys, offsets, scrollTop}; after: {keys, offsets}.
 * A missing anchor leaves the previous scroll position alone.
 * @param {{keys: string[], offsets: Float64Array, scrollTop: number}} before
 * @param {{keys: string[], offsets: Float64Array}} after
 * @param {string} anchorKey
 * @returns {number}
 */
export function anchorScrollTop(before, after, anchorKey) {
  const from = before.keys.indexOf(anchorKey);
  const to = after.keys.indexOf(anchorKey);
  return from < 0 || to < 0
    ? before.scrollTop
    : Math.max(0, before.scrollTop + after.offsets[to] - before.offsets[from]);
}
