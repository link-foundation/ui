import { parseNested } from '@link-foundation/ui-core';
import { corners, lines } from './frames.js';

export const FRAME_LEVELS = [
  'panel',
  'control',
  'button',
  'field',
  'tab',
  'chip',
  'menu',
  'nav',
  'subnav',
  'table',
];
export const FRAME_CORNERS = [
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
];
export const FRAME_EDGES = ['top', 'right', 'bottom', 'left'];
const STATES = ['hover', 'active', 'selected', 'focus', 'disabled'];
const blank = () => ({ corners: {}, edges: {}, states: {} });
const atom = (link) => {
  if (!link || link.values.length) {
    throw new TypeError('Expected a frame atom');
  }
  return link.id;
};
const nonnegative = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new RangeError('Frame dimensions must be nonnegative finite pixels');
  }
  return n;
};
function readProperties(nodes, allowed) {
  const result = {};
  for (const node of nodes) {
    const key = atom(node.values[0]);
    if (
      !allowed.includes(key) ||
      node.values.length !== 2 ||
      Object.hasOwn(result, key)
    ) {
      throw new TypeError(`Unknown or duplicate frame property: ${key}`);
    }
    const value = atom(node.values[1]);
    result[key] = key === 'color' ? value : nonnegative(value);
  }
  return result;
}
function readPart(result, kind, name, shape, properties) {
  const isCorner = kind === 'corner';
  const names = isCorner ? FRAME_CORNERS : FRAME_EDGES;
  const id = atom(name);
  const value = atom(shape);
  if (!names.includes(id) || !(isCorner ? corners : lines).includes(value)) {
    throw new TypeError(`Unknown frame ${kind} name or shape: ${id} ${value}`);
  }
  const collection = isCorner ? result.corners : result.edges;
  if (collection[id]) {
    throw new TypeError(`Duplicate frame ${kind}: ${id}`);
  }
  collection[id] = {
    [isCorner ? 'shape' : 'line']: value,
    ...readProperties(
      properties,
      isCorner
        ? ['size', 'width', 'height', 'stroke', 'color']
        : ['stroke', 'color', 'gap']
    ),
  };
}
function readLevel(nodes, state = false) {
  const result = blank();
  for (const node of nodes) {
    const [head, name, shape, ...properties] = node.values;
    const kind = atom(head);
    if (
      kind === 'extends' &&
      !state &&
      node.values.length === 2 &&
      !result.extends
    ) {
      result.extends = atom(name);
    } else if (kind === 'state' && !state) {
      const id = atom(name);
      if (!STATES.includes(id) || result.states[id]) {
        throw new TypeError(`Unknown or duplicate frame state: ${id}`);
      }
      result.states[id] = readLevel(node.values.slice(2), true);
    } else if (kind === 'corner' || kind === 'edge') {
      readPart(result, kind, name, shape, properties);
    } else {
      throw new TypeError(`Unknown frame declaration: ${kind}`);
    }
  }
  return result;
}

/** Public frame vocabulary: docs/spec/frames.md. Parsed by links-notation. */
export function readFrames(text) {
  const roots = parseNested(text);
  if (roots.length !== 1 || atom(roots[0].values[0]) !== 'frames') {
    throw new TypeError('Expected one frames root');
  }
  const result = new Map();
  for (const level of roots[0].values.slice(1)) {
    const name = level.values.length ? atom(level.values[0]) : atom(level);
    if (!FRAME_LEVELS.includes(name)) {
      throw new TypeError(`Unknown frame level: ${name}`);
    }
    if (result.has(name)) {
      throw new TypeError(`Duplicate frame level: ${name}`);
    }
    result.set(name, readLevel(level.values.slice(1)));
  }
  return result;
}
const merge = (target, patch) => {
  for (const part of ['corners', 'edges']) {
    for (const [name, properties] of Object.entries(patch[part])) {
      target[part][name] = { ...target[part][name], ...properties };
    }
  }
};
/** Explicit inheritance only; ordered states override their inherited state. */
export function resolveFrame(frames, level, states = []) {
  for (const state of states) {
    if (!STATES.includes(state)) {
      throw new TypeError(`Unknown frame state: ${state}`);
    }
  }
  const chain = [];
  const seen = new Set();
  let name = level;
  while (name) {
    if (seen.has(name)) {
      throw new TypeError('Frame inheritance cycle');
    }
    seen.add(name);
    const entry = frames.get(name);
    if (!entry) {
      throw new TypeError(`Unknown frame level: ${name}`);
    }
    chain.unshift(entry);
    name = entry.extends;
  }
  const result = {
    corners: Object.fromEntries(
      FRAME_CORNERS.map((id) => [
        id,
        { shape: 'square', size: 0, stroke: 1, color: 'currentColor' },
      ])
    ),
    edges: Object.fromEntries(
      FRAME_EDGES.map((id) => [
        id,
        { line: 'line', stroke: 1, color: 'currentColor', gap: 8 },
      ])
    ),
  };
  for (const entry of chain) {
    merge(result, entry);
  }
  for (const state of states) {
    for (const entry of chain) {
      if (entry.states[state]) {
        merge(result, entry.states[state]);
      }
    }
  }
  return result;
}
const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

function sizedCorners(frame) {
  return FRAME_CORNERS.map((id) => {
    const c = frame.corners[id];
    return {
      ...c,
      width:
        c.shape === 'square'
          ? 0
          : (c.width ?? c.size * (c.shape === 'tall' ? 0.5 : 1)),
      height:
        c.shape === 'square'
          ? 0
          : (c.height ?? c.size * (c.shape === 'wide' ? 0.5 : 1)),
    };
  });
}

/**
 * A transparent contour plus separate stroke paths. Apply clipPath to a material
 * layer and place borderSvg above it; neither layer paints an opaque cutout.
 */
export function frameGeometry(frame, width, height) {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) {
    throw new RangeError('Frame dimensions must be positive finite pixels');
  }
  const cs = sizedCorners(frame);
  const scale = Math.min(
    1,
    width / Math.max(cs[0].width + cs[1].width, Number.EPSILON),
    width / Math.max(cs[2].width + cs[3].width, Number.EPSILON),
    height / Math.max(cs[0].height + cs[3].height, Number.EPSILON),
    height / Math.max(cs[1].height + cs[2].height, Number.EPSILON)
  );
  for (const c of cs) {
    c.width *= scale;
    c.height *= scale;
  }
  // Each corner is described in local coordinates from (0,h) to (w,0).
  const transforms = [
    (x, y) => [x, y],
    (x, y) => [width - y, x],
    (x, y) => [width - x, height - y],
    (x, y) => [y, height - x],
  ];
  const starts = [],
    ends = [],
    curves = [];
  for (let i = 0; i < 4; i++) {
    const c = cs[i];
    const w = i % 2 ? c.height : c.width;
    const h = i % 2 ? c.width : c.height;
    const at = (x, y) => transforms[i](x, y).join(' ');
    starts.push(at(0, h));
    ends.push(at(w, 0));
    const end = ends[i];
    curves.push(
      c.shape === 'round'
        ? `Q ${at(0, 0)} ${end}`
        : c.shape === 'scoop'
          ? `Q ${at(w, h)} ${end}`
          : c.shape === 'notch'
            ? `L ${at(w / 2, h)} L ${at(w / 2, h / 2)} L ${at(w, h / 2)} L ${end}`
            : `L ${end}`
    );
  }
  let path = `M ${starts[0]} ${curves[0]}`;
  for (let i = 1; i < 4; i++) {
    path += ` L ${starts[i]} ${curves[i]}`;
  }
  path += ' Z';
  const stroke = (d, c, extra = '') =>
    `<path d="${esc(d)}" fill="none" stroke="${esc(c.color)}" stroke-width="${c.stroke}" ${extra}/>`;
  let strokes = cs
    .map((c, i) => stroke(`M ${starts[i]} ${curves[i]}`, c))
    .join('');
  for (let i = 0; i < 4; i++) {
    const edge = frame.edges[FRAME_EDGES[i]];
    if (edge.line === 'none') {
      continue;
    }
    const next = (i + 1) % 4;
    const a = ends[i].split(' ').map(Number),
      b = starts[next].split(' ').map(Number);
    const segment = (from, to) => `M ${from.join(' ')} L ${to.join(' ')}`;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (edge.line === 'bracket' && length > 0) {
      const f = Math.min(edge.gap, length / 2) / length;
      const interpolate = (t) => a.map((v, j) => v + (b[j] - v) * t);
      strokes += stroke(
        `${segment(a, interpolate(f))} ${segment(interpolate(1 - f), b)}`,
        edge
      );
    } else {
      strokes += stroke(
        segment(a, b),
        edge,
        edge.line === 'gap' ? `stroke-dasharray="${edge.gap} ${edge.gap}"` : ''
      );
    }
  }
  return {
    path,
    clipPath: `path("${path}")`,
    corners: Object.fromEntries(FRAME_CORNERS.map((id, i) => [id, cs[i]])),
    borderSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${strokes}</svg>`,
  };
}
