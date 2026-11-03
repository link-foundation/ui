/** Selection has no DOM dependency. Ranges use the current outline order. */
export function createSelection(initial = []) {
  let ids = new Set(initial);
  let anchor = initial.at(-1) ?? null;
  return {
    get ids() {
      return new Set(ids);
    },
    get anchor() {
      return anchor;
    },
    select(id) {
      ids = new Set(id === null ? [] : [id]);
      anchor = id;
    },
    replace(next) {
      ids = new Set(next);
      anchor = [...ids].at(-1) ?? null;
    },
    toggle(id) {
      if (ids.has(id)) {
        ids.delete(id);
      } else {
        ids.add(id);
      }
      anchor = id;
    },
    range(id, order) {
      const from = order.indexOf(anchor);
      const to = order.indexOf(id);
      if (from < 0 || to < 0) {
        this.select(id);
        return;
      }
      ids = new Set(order.slice(Math.min(from, to), Math.max(from, to) + 1));
    },
    retain(available) {
      const allowed = new Set(available);
      ids = new Set([...ids].filter((id) => allowed.has(id)));
      if (!allowed.has(anchor)) {
        anchor = [...ids].at(-1) ?? null;
      }
    },
  };
}

export function normalizedRect({ x, y, width, height }) {
  return {
    x: Math.min(x, x + width),
    y: Math.min(y, y + height),
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

/** Intersecting rectangles; negative marquee dimensions work in every drag direction. */
export function marquee(rects, box) {
  const b = normalizedRect(box);
  return rects
    .filter(
      (r) =>
        r.x <= b.x + b.width &&
        r.x + r.width >= b.x &&
        r.y <= b.y + b.height &&
        r.y + r.height >= b.y
    )
    .map((r) => r.id);
}
