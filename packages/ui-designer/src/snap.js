/** Snap in CSS pixels. Ties resolve in sibling order, then leading/centre/trailing order. */
export function computeSnap(moving, others, { threshold = 6 } = {}) {
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error('Invalid snap threshold');
  }
  const result = { dx: 0, dy: 0, guides: [] };
  for (const [axis, size, cross, span, delta] of [
    ['x', 'width', 'y', 'height', 'dx'],
    ['y', 'height', 'x', 'width', 'dy'],
  ]) {
    let best = null;
    for (const other of others) {
      for (const fraction of [0, 0.5, 1]) {
        const position = other[axis] + other[size] * fraction;
        for (const own of [0, 0.5, 1]) {
          const offset = position - moving[axis] - moving[size] * own;
          if (
            Math.abs(offset) <= threshold &&
            (best === null || Math.abs(offset) < Math.abs(best.offset))
          ) {
            best = {
              offset,
              guide: {
                axis,
                position,
                from: Math.min(moving[cross], other[cross]),
                to: Math.max(
                  moving[cross] + moving[span],
                  other[cross] + other[span]
                ),
              },
            };
          }
        }
      }
    }
    if (best) {
      result[delta] = best.offset;
      result.guides.push(best.guide);
    }
  }
  return result;
}
