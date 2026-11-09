import { add, scale, distance } from './geometry.js';
import { force } from './layouts/force.js';
import { layered } from './layouts/layered.js';
import { buildNetwork } from './network-model.js';

export const radians = (degrees) => (degrees * Math.PI) / 180;
export const rotate = (p, degrees) => {
  const a = radians(degrees),
    c = Math.cos(a),
    s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};
export const unit = (p, fallback = { x: 1, y: 0 }) => {
  const d = Math.hypot(p.x, p.y);
  return d > 1e-12 ? scale(p, 1 / d) : fallback;
};

function dicePoint(i, n, columns) {
  const face = Math.floor(i / 6),
    count = Math.min(6, n - face * 6),
    index = i % 6;
  const pips = {
    1: [[0, 0]],
    2: [
      [-0.5, -0.5],
      [0.5, 0.5],
    ],
    3: [
      [-1, -1],
      [0, 0],
      [1, 1],
    ],
    4: [
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
    ],
    5: [
      [-1, -1],
      [1, -1],
      [0, 0],
      [-1, 1],
      [1, 1],
    ],
    6: [
      [-0.5, -1],
      [0.5, -1],
      [-0.5, 0],
      [0.5, 0],
      [-0.5, 1],
      [0.5, 1],
    ],
  }[count];
  const p = pips[index],
    cols = columns || Math.ceil(Math.sqrt(Math.ceil(n / 6)));
  const step = [2, 3, 5].includes(count) ? Math.SQRT2 : 1;
  return {
    x: p[0] / step + (face % cols) * 3,
    y: p[1] / step + Math.floor(face / cols) * 3,
  };
}
function place(layout, i, n, o) {
  const cols = o.columns || Math.ceil(Math.sqrt(n / o.layoutAspect));
  if (layout === 'circle') {
    const radius = n > 1 ? 1 / (2 * Math.sin(Math.PI / n)) : 0;
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  }
  if (layout === 'dice') {
    return dicePoint(i, n, o.columns);
  }
  if (layout === 'cards') {
    return { x: i % 2 ? 0.7 : -0.7, y: Math.floor(i / 2) };
  }
  if (layout === 'spiral') {
    const a = i * Math.PI * (3 - Math.sqrt(5)),
      r = Math.sqrt(i);
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  }
  if (layout === 'layered') {
    return { x: i % cols, y: Math.floor(i / cols) };
  }
  const row = Math.floor(i / cols);
  return {
    x: (i % cols) + (layout === 'hex' ? (row % 2) / 2 : 0),
    y: row * (layout === 'hex' ? Math.sqrt(3) / 2 : 1),
  };
}

/** Layout coordinates precede the uniform box fit. Circle neighbours are one unit apart. */
export function doubletPlaces(pairs, o) {
  const n = pairs.length;
  const layout = o.layout === 'auto' ? (n <= 4 ? 'circle' : 'hex') : o.layout;
  const points = ['force', 'layered'].includes(layout)
    ? graphPlaces(pairs, layout)
    : Array.from({ length: n }, (_, i) => place(layout, i, n, o));
  if (layout === 'spiral') {
    normalizeSpacing(points);
  }
  const center = points.length
    ? scale(points.reduce(add, { x: 0, y: 0 }), 1 / n)
    : { x: 0, y: 0 };
  const order =
    layout === 'circle' && o.order ? o.order : points.map((_, i) => i + 1);
  return new Map(
    points.map((p, i) => [
      order[i],
      rotate(
        {
          x: (p.x - center.x) * o.spread * Math.sqrt(o.layoutAspect),
          y: ((p.y - center.y) * o.spread) / Math.sqrt(o.layoutAspect),
        },
        o.rotation
      ),
    ])
  );
}
function graphPlaces(pairs, layout) {
  const network = buildNetwork(
    pairs.map(([source, target], i) => ({ id: i + 1, source, target }))
  );
  const raw = (layout === 'force' ? force : layered)(network, {
    width: 300,
    height: 300,
    maxTicks: 100,
  });
  const points = pairs.map((_, i) => raw.get(i + 1));
  return normalizeSpacing(points);
}
// Normalize the nearest distinct pair to one layout unit.
function normalizeSpacing(points) {
  let nearest = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = distance(points[i], points[j]);
      if (d > 1e-9) {
        nearest = Math.min(nearest, d);
      }
    }
  }
  const k = Number.isFinite(nearest) ? 1 / nearest : 1;
  for (const p of points) {
    p.x *= k;
    p.y *= k;
  }
  return points;
}
