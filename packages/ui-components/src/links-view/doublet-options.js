import { parseNested } from '@link-foundation/ui-core';

export const DOUBLET_MARKERS = Object.freeze([
  'bar',
  'arrow',
  'triangle',
  'tail',
  'dot',
  'circle',
  'square',
  'diamond',
  'none',
]);

// Each call owns its mutable configuration, including explicit marker fields.
function defaults() {
  const marker = (shape, size, angle = 45, offset = 0) => ({
    shape,
    size,
    angle,
    offset,
    across: 0,
    rotation: 0,
    explicit: [],
  });
  return {
    layout: 'auto',
    layoutAspect: 1,
    columns: 0,
    spread: 1,
    rotation: 0,
    free: 1,
    loop: 1,
    bulge: 0,
    loopBend: 0,
    angles: 'fixed',
    sourceAngle: 30,
    targetAngle: 30,
    tension: 0.4,
    gaps: [0.08, 0.08, 0, 0],
    links: {},
    order: null,
    frame: null,
    padding: 9,
    start: marker('bar', 2.5, 70, 2.5),
    end: marker('arrow', 3.5),
    middle: marker('dot', 2),
    strokeWidth: 1,
    color: '#202b3d',
    dash: 'solid',
    linecap: 'round',
    opacity: 1,
    glow: 0,
    arrowJoin: 'miter',
    balanceArrows: true,
    background: {
      type: 'transparent',
      color: '#ffffff',
      color2: '#dbeafe',
      angle: 0,
    },
    card: {
      color: '#ffffff',
      opacity: 0,
      border: 'none',
      borderColor: '#202b3d',
      width: 1,
      radius: 0,
      inset: 0,
    },
    caption: {
      mode: 'none',
      text: '',
      font: 'mono',
      size: 5,
      color: '#202b3d',
    },
    width: 640,
    height: 640,
  };
}

const RANGES = Object.freeze({
  layoutAspect: Object.freeze([0.3, 3]),
  columns: Object.freeze([0, 30]),
  spread: Object.freeze([0, 100]),
  rotation: Object.freeze([-180, 180]),
  free: Object.freeze([0, 10]),
  loop: Object.freeze([0, 10]),
  bulge: Object.freeze([-180, 180]),
  loopBend: Object.freeze([-180, 180]),
  sourceAngle: Object.freeze([-180, 180]),
  targetAngle: Object.freeze([-180, 180]),
  tension: Object.freeze([0, 2]),
  padding: Object.freeze([0, 48]),
  strokeWidth: Object.freeze([0.5, 10]),
  opacity: Object.freeze([0.1, 1]),
  glow: Object.freeze([0, 12]),
  width: Object.freeze([64, 4096]),
  height: Object.freeze([64, 4096]),
});
const ENUMS = Object.freeze({
  layout: 'auto circle grid hex spiral dice cards force layered',
  angles: 'fixed mirror',
  dash: 'solid dashed dotted dashdot long',
  linecap: 'butt round square',
  arrowJoin: 'miter round bevel',
});
function numeric(value, range, name) {
  const n =
    typeof value === 'number'
      ? value
      : value.trim() === ''
        ? NaN
        : Number(value);
  if (!Number.isFinite(n) || n < range[0] || n > range[1]) {
    throw new RangeError(`${name} must be in ${range[0]}..${range[1]}`);
  }
  return n;
}
function choice(value, choices, name) {
  if (!choices.split(' ').includes(value)) {
    throw new RangeError(`Unknown ${name}: ${value}`);
  }
  return value;
}
const atom = (link) => {
  if (link.values.length || link.id === null) {
    throw new TypeError('Expected an option atom');
  }
  return link.id;
};
function fields(links, apply) {
  const seen = new Set();
  for (const link of links) {
    const [head, ...values] = link.values;
    const name = link.id ?? (head && atom(head));
    const rest = link.id === null ? values : link.values;
    if (!name || seen.has(name)) {
      throw new TypeError(`Missing or duplicate option: ${name}`);
    }
    seen.add(name);
    apply(name, rest);
  }
}
function scalar(values) {
  if (values.length !== 1) {
    throw new TypeError('Expected one option value');
  }
  return atom(values[0]);
}
function vector(values, ranges, name, inherit = false) {
  if (values.length !== ranges.length) {
    throw new TypeError(`${name} needs ${ranges.length} values`);
  }
  return values.map((v, i) =>
    inherit && ['~', 'null'].includes(atom(v))
      ? null
      : numeric(atom(v), ranges[i], name)
  );
}
function markerOptions(target, values) {
  fields(values, (name, list) => {
    const value = scalar(list);
    if (name === 'shape') {
      target.shape = choice(value, DOUBLET_MARKERS.join(' '), name);
    } else {
      const ranges = {
        size: [0.5, 15],
        angle: [5, 85],
        offset: [-20, 20],
        across: [-20, 20],
        rotation: [-180, 180],
      };
      if (!Object.hasOwn(ranges, name)) {
        throw new TypeError(`Unknown marker option: ${name}`);
      }
      target[name] = numeric(value, ranges[name], name);
    }
    target.explicit.push(name);
  });
}
function styleGroup(target, values, group) {
  fields(values, (name, list) => {
    const value = scalar(list);
    if (!Object.hasOwn(target, name)) {
      throw new TypeError(`Unknown ${group} option: ${name}`);
    }
    const enums = {
      type: 'transparent solid linear radial',
      border: 'solid dashed dotted double none',
      mode: 'none theory pairs number links custom',
      font: 'mono sans serif',
    };
    const ranges = {
      opacity: [0, 1],
      width: [0.1, 6],
      radius: [0, 50],
      inset: [0, 30],
      size: [3, 14],
      angle: [-180, 180],
    };
    target[name] = enums[name]
      ? choice(value, enums[name], name)
      : ranges[name]
        ? numeric(value, ranges[name], name)
        : value;
    if (name === 'text' && [...value].length > 80) {
      throw new RangeError('Caption text exceeds 80 characters');
    }
  });
}
function linkOptions(values, config, count) {
  const id = numeric(atom(values[0]), [1, count], 'link id');
  if (!Number.isInteger(id) || config.links[id]) {
    throw new RangeError('Duplicate or noninteger link id');
  }
  const entry = { turns: [0, 0], gaps: [null, null, null, null] };
  fields(values.slice(1), (name, list) => {
    if (name === 'turns') {
      entry.turns = vector(
        list,
        [
          [-180, 180],
          [-180, 180],
        ],
        name
      );
      if (!entry.turns.every(Number.isInteger)) {
        throw new RangeError('Turns must be integer degrees');
      }
    } else if (name === 'gaps') {
      entry.gaps = vector(
        list,
        [
          [0, 1],
          [0, 1],
          [0, 30],
          [0, 30],
        ],
        name,
        true
      );
    } else {
      throw new TypeError(`Unknown per-link option: ${name}`);
    }
  });
  config.links[id] = entry;
}
function readFrame(values) {
  const raw = values.length === 1 ? parseNested(scalar(values)) : [];
  if (raw.length > 1) {
    throw new TypeError('Frame needs exactly three numbers');
  }
  const parts = raw.length
    ? raw[0].id === null
      ? raw[0].values
      : raw
    : values;
  const frame = vector(
    parts,
    [
      [-1e6, 1e6],
      [-1e6, 1e6],
      [-1e6, 1e6],
    ],
    'frame'
  );
  if (frame[0] <= 1e-9 || frame[0] > 60) {
    throw new RangeError('Frame scale must be in (1e-9, 60]');
  }
  return frame;
}
function specialOption(config, name, values, count) {
  if (name === 'gaps') {
    config.gaps = vector(
      values,
      [
        [0, 1],
        [0, 1],
        [0, 30],
        [0, 30],
      ],
      name
    );
  } else if (name === 'order') {
    config.order = values.map((v) => numeric(atom(v), [1, count], name));
    if (
      config.order.length !== count ||
      new Set(config.order).size !== count ||
      !config.order.every(Number.isInteger)
    ) {
      throw new RangeError('Circle order must be a permutation of every id');
    }
  } else if (name === 'frame') {
    config.frame = readFrame(values);
  } else if (['start', 'end', 'middle'].includes(name)) {
    markerOptions(config[name], values);
  } else if (['background', 'card', 'caption'].includes(name)) {
    styleGroup(config[name], values, name);
  } else if (name === 'balanceArrows') {
    config[name] = choice(scalar(values), 'true false', name) === 'true';
  } else if (name === 'color') {
    config.color = scalar(values);
  } else {
    throw new TypeError(`Unknown doublet option: ${name}`);
  }
}

/** Strict provider options in official, nested Links Notation. */
export function readDoubletOptions(text = '', count = 0) {
  const config = defaults();
  // Repeated `link` records carry separate per-link overrides.
  const links = parseNested(text);
  const global = [];
  for (const link of links) {
    const name = link.id ?? link.values[0]?.id;
    if (name === 'link') {
      linkOptions(
        link.id === null ? link.values.slice(1) : link.values,
        config,
        count
      );
    } else {
      global.push(link);
    }
  }
  fields(global, (name, values) => {
    if (Object.hasOwn(RANGES, name)) {
      config[name] = numeric(scalar(values), RANGES[name], name);
    } else if (Object.hasOwn(ENUMS, name)) {
      config[name] = choice(scalar(values), ENUMS[name], name);
    } else {
      specialOption(config, name, values, count);
    }
  });
  if (!Number.isInteger(config.columns)) {
    throw new RangeError('Columns must be an integer');
  }
  return config;
}

/** Normalize pairs or the bridge's explicit 1-based item records. */
export function doubletPairs(items) {
  if (!Array.isArray(items)) {
    throw new TypeError('Doublets must be an array');
  }
  return items.map((item, i) => {
    const pair = Array.isArray(item) ? item : [item?.source, item?.target];
    if (
      pair.length !== 2 ||
      (!Array.isArray(item) && String(item.id) !== String(i + 1))
    ) {
      throw new TypeError(
        'Doublet items need two ends and sequential 1-based ids'
      );
    }
    return pair.map((value) => {
      const n =
        typeof value === 'string' && value.trim() !== ''
          ? Number(value)
          : value;
      if (!Number.isInteger(n) || n < 0 || n > items.length) {
        throw new RangeError('Doublet references must be integers in 0..n');
      }
      return n;
    });
  });
}
