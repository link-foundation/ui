import { parseNested } from '@link-foundation/ui-core';
export { frameGeometry } from './frame-geometry.js';
import { corners, lines } from './frame-vocabulary.js';

export const FRAME_LEVELS = [
  'panel',
  'block',
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
export const FRAME_STATES = [
  'hover',
  'active',
  'selected',
  'focus',
  'disabled',
];
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
export const FRAME_STYLES = ['solid', 'dashed', 'dotted', 'double'];
export const FRAME_MODES = ['frame', 'own', 'border'];
export const FRAME_LAYERS = ['above', 'below'];
const enums = {
  style: FRAME_STYLES,
  mode: FRAME_MODES,
  layer: FRAME_LAYERS,
  line: lines,
};
const levelKeys = [
  'style',
  'mode',
  'layer',
  'opacity',
  'stroke',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'fitScale',
];
const ranges = {
  opacity: (n) => n <= 1,
  fitScale: (n) => n <= 1,
  scale: (n) => n >= 0.1 && n <= 1,
  stroke: (n) => n <= 12,
  'min-width': (n) => n <= 1600,
  'max-width': (n) => n <= 1600,
  'min-height': (n) => n <= 1600,
  'max-height': (n) => n <= 1600,
};
function propertyValue(key, value) {
  if (enums[key]) {
    if (!enums[key].includes(value)) {
      throw new TypeError(`Unknown frame ${key}: ${value}`);
    }
    return value;
  }
  if (key === 'color') {
    return value;
  }
  if (
    value === 'auto' &&
    ['size', 'width', 'height', 'arm', 'stroke'].includes(key)
  ) {
    return value;
  }
  const n = nonnegative(value);
  if (ranges[key] && !ranges[key](n)) {
    throw new RangeError(`Invalid frame ${key}: ${value}`);
  }
  return n;
}
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
    result[key] = propertyValue(key, atom(node.values[1]));
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
        ? ['size', 'width', 'height', 'stroke', 'color', 'line', 'arm']
        : ['stroke', 'color', 'gap', 'style']
    ),
  };
  if (
    isCorner &&
    typeof collection[id].stroke === 'number' &&
    !Number.isInteger(collection[id].stroke * 2)
  ) {
    throw new RangeError('Corner strokes use half-pixel steps');
  }
}
function readLevel(nodes, state = false) {
  const result = blank();
  for (const node of nodes) {
    const [head, name, shape, ...properties] = node.values;
    const kind = atom(head);
    if (
      kind === 'extends' &&
      !state &&
      node.values.length >= 2 &&
      !result.extends
    ) {
      result.extends = atom(name);
      Object.assign(result, readProperties(node.values.slice(2), ['scale']));
    } else if (kind === 'state' && !state) {
      const id = atom(name);
      if (!FRAME_STATES.includes(id) || result.states[id]) {
        throw new TypeError(`Unknown or duplicate frame state: ${id}`);
      }
      result.states[id] = readLevel(node.values.slice(2), true);
    } else if (levelKeys.includes(kind) && !Object.hasOwn(result, kind)) {
      Object.assign(result, readProperties([node], levelKeys));
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
    const definition = readLevel(level.values.slice(1));
    if (definition.extends && definition.scale === undefined) {
      definition.scale = { block: 0.6, control: 0.35 }[name] ?? 1;
    }
    result.set(name, definition);
  }
  return result;
}
const merge = (target, patch) => {
  for (const key of levelKeys) {
    if (patch[key] !== undefined) {
      target[key] = patch[key];
    }
  }
  for (const part of ['corners', 'edges']) {
    for (const [name, properties] of Object.entries(patch[part])) {
      const explicit = Object.fromEntries(
        Object.entries(properties).filter(
          ([key, value]) => value !== 'auto' || key === 'stroke'
        )
      );
      target[part][name] = { ...target[part][name], ...explicit };
    }
  }
};
const dimensions = ['size', 'width', 'height', 'arm'];
function scaleCorners(cs, scale) {
  for (const c of Object.values(cs)) {
    for (const key of dimensions) {
      if (typeof c[key] === 'number') {
        c[key] *= scale;
      }
    }
  }
}
function completeFrame(result) {
  for (const edge of Object.values(result.edges)) {
    if (edge.stroke === 'auto') {
      edge.stroke = result.stroke === 'auto' ? 1 : result.stroke;
    }
    if (edge.style === 'auto') {
      edge.style = result.style;
    }
  }
  FRAME_CORNERS.forEach((id, i) => {
    if (result.corners[id].stroke === 'auto') {
      result.corners[id].stroke = result.edges[FRAME_EDGES[i]].stroke;
    }
  });
}
function mergeStates(result, chain, states) {
  for (const state of states) {
    chain.forEach((entry, index) => {
      if (!entry.states[state]) {
        return;
      }
      const statePatch = entry.states[state];
      const patch = {
        ...statePatch,
        corners: Object.fromEntries(
          Object.entries(statePatch.corners).map(([id, c]) => [id, { ...c }])
        ),
      };
      const scale = chain
        .slice(index + 1)
        .reduce((value, child) => value * (child.scale ?? 1), 1);
      scaleCorners(patch.corners, scale);
      merge(result, patch);
    });
  }
}
/** Explicit inheritance only; ordered states override their inherited state. */
export function resolveFrame(frames, level, states = []) {
  for (const state of states) {
    if (!FRAME_STATES.includes(state)) {
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
    mode: 'own',
    layer: 'above',
    opacity: 1,
    style: 'solid',
    stroke: 1,
    'min-width': 0,
    'max-width': 0,
    'min-height': 0,
    'max-height': 0,
    fitScale: 0.5,
    corners: Object.fromEntries(
      FRAME_CORNERS.map((id) => [
        id,
        {
          shape: 'square',
          size: 0,
          stroke: 'auto',
          color: 'currentColor',
          line: 'accent',
          arm: 8,
        },
      ])
    ),
    edges: Object.fromEntries(
      FRAME_EDGES.map((id) => [
        id,
        {
          line: 'line',
          stroke: 'auto',
          color: 'currentColor',
          gap: 8,
          style: 'auto',
        },
      ])
    ),
  };
  for (const entry of chain) {
    scaleCorners(result.corners, entry.scale ?? 1);
    merge(
      result,
      entry.mode === 'frame' ? { ...entry, corners: {}, edges: {} } : entry
    );
  }
  mergeStates(result, chain, states);
  completeFrame(result);
  return result;
}
