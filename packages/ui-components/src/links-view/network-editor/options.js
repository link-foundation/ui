import { parseNested, formatLinks } from '@link-foundation/ui-core';
import { networkOptionSchema } from './schema.js';
import {
  hasLegacyOptions,
  readLegacyOptions,
  legacyAngle,
  legacyOptionKeys,
  legacyRows,
} from './legacy-options.js';
export { networkOptionSchema, optionAvailable } from './schema.js';

const cssColor = (value, fallback = null) => {
  if (typeof value === 'string' && /^#[\da-f]{6}$/iu.test(value)) {
    return value.toLowerCase();
  }
  return value === 'currentColor' ? value : fallback;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clamp = (value, min, max, fallback) => {
  const n = value === '' || value === null ? NaN : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
function scalar(field, value) {
  if (field.type === 'number') {
    const n = clamp(value, field.min, field.max, field.default);
    return field.step === 1 ? Math.round(n) : n;
  }
  if (field.type === 'boolean') {
    return [true, 'true', '1'].includes(value)
      ? true
      : [false, 'false', '0'].includes(value)
        ? false
        : field.default;
  }
  if (field.choices) {
    return field.choices.includes(value) ? value : field.default;
  }
  if (field.type === 'color') {
    return cssColor(value, field.default);
  }
  return typeof value === 'string'
    ? [...value].slice(0, 80).join('')
    : field.default;
}

function normalizedFrame(frame) {
  return Array.isArray(frame) &&
    frame.length === 3 &&
    frame.every(
      (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e6
    ) &&
    frame[0] > 1e-9 &&
    frame[0] <= 60
    ? [...frame]
    : null;
}

/** Clamp invalid scalar values and detach every per-link override. */
export function normalize(input = {}) {
  const source = { ...input };
  if (source.gap !== undefined) {
    source.startGap ??= source.gap;
    source.endGap ??= source.gap;
  }
  if (
    networkOptionSchema.some(
      (f) =>
        f.type === 'color' &&
        Object.hasOwn(source, f.key) &&
        (!source.palette ||
          (source.palette === 'default' && source[f.key] !== f.default))
    )
  ) {
    source.palette = 'custom';
  }
  const output = Object.fromEntries(
    networkOptionSchema.map((field) => [
      field.key,
      scalar(field, source[field.key]),
    ])
  );
  const vector = (raw, ranges, inherit = false) =>
    Array.isArray(raw)
      ? ranges.map(([min, max], i) =>
          inherit && (raw[i] === null || raw[i] === undefined)
            ? null
            : clamp(raw[i], min, max, 0)
        )
      : null;
  output.turns = Array.isArray(source.turns)
    ? source.turns.map((v) =>
        (
          vector(v, [
            [-180, 180],
            [-180, 180],
          ]) ?? [0, 0]
        ).map(Math.round)
      )
    : [];
  output.linkGaps = Array.isArray(source.linkGaps)
    ? source.linkGaps.map(
        (v) =>
          vector(
            v,
            [
              [0, 1],
              [0, 1],
              [0, 30],
              [0, 30],
            ],
            true
          ) ?? [null, null, null, null]
      )
    : [];
  output.linkColors = Array.isArray(source.linkColors)
    ? source.linkColors.map((v) => cssColor(v))
    : [];
  output.order =
    Array.isArray(source.order) &&
    source.order.length > 0 &&
    source.order.every(
      (v) => Number.isInteger(v) && v > 0 && v <= source.order.length
    ) &&
    new Set(source.order).size === source.order.length
      ? [...source.order]
      : null;
  output.frame = normalizedFrame(source.frame);
  return output;
}

const specialKeys = Object.freeze([
  'turns',
  'linkGaps',
  'linkColors',
  'order',
  'frame',
]);
/** Only nondefault values enter URLSearchParams. Complex values use LiNo. */
export function toParams(input) {
  const options = normalize(input);
  const defaults = normalize({});
  const params = new globalThis.URLSearchParams();
  for (const key of [
    ...networkOptionSchema.map((field) => field.key),
    ...specialKeys,
  ]) {
    if (!same(options[key], defaults[key])) {
      params.set(
        key,
        specialKeys.includes(key)
          ? formatValue(key, options[key])
          : String(options[key])
      );
    }
  }
  return params;
}
function formatValue(key, value) {
  if (value === null) {
    return '';
  }
  if (['turns', 'linkGaps'].includes(key)) {
    return formatLinks(
      value.map((row, i) => ({
        id: String(i + 1),
        values: row.map((v) => (v === null ? '~' : String(v))),
      }))
    );
  }
  return formatLinks([value.map((v) => (v === null ? '~' : String(v)))]);
}
function parseValue(key, text) {
  const links = parseNested(text);
  const atom = (v) =>
    v.id === '~' ? null : key === 'linkColors' ? v.id : Number(v.id);
  if (['turns', 'linkGaps'].includes(key)) {
    if (!links.every((v, i) => v.id === String(i + 1))) {
      return [];
    }
    return links.map((v) => v.values.map(atom));
  }
  return links.length === 1
    ? links[0].values.length
      ? links[0].values.map(atom)
      : [atom(links[0])]
    : [];
}
const optionKeys = Object.freeze(
  networkOptionSchema.map((field) => field.key).concat('gap', specialKeys)
);
export const networkUrlOptionKeys = Object.freeze(
  optionKeys.concat(legacyOptionKeys)
);

export function fromParams(value, { legacy } = {}) {
  const params = new globalThis.URLSearchParams(value);
  const legacyUrl = legacy ?? hasLegacyOptions(params);
  const raw = readLegacyOptions(params, legacyUrl);
  for (const key of optionKeys) {
    if (!params.has(key)) {
      continue;
    }
    try {
      const value = params.get(key);
      const parsed = specialKeys.includes(key) ? parseValue(key, value) : value;
      raw[key] =
        key === 'turns' && !parsed.length && value ? legacyRows(value) : parsed;
    } catch {
      if (key === 'turns') {
        raw.turns = legacyRows(params.get(key));
      }
    }
  }
  if (legacyUrl) {
    raw.rotation = legacyAngle(raw.rotation);
    if (raw.palette === 'custom') {
      raw.palette = 'site';
    }
  }
  return normalize(raw);
}

/** Canonical editor state for saved styles and presentation adapters. */
export function toOptions(input) {
  return formatLinks([...toParams(input)].map(([key, value]) => [key, value]));
}
export function fromOptions(text = '') {
  const params = new globalThis.URLSearchParams();
  for (const link of parseNested(text)) {
    if (link.id === null && link.values.length === 2) {
      params.set(link.values[0].id, link.values[1].id);
    }
  }
  return fromParams(params, { legacy: false });
}

export function editOptions(input, patch, { countChanged = false } = {}) {
  // Selecting the default palette restores its colours; otherwise inherited
  // custom colours would immediately normalize the selection back to custom.
  const palette =
    patch.palette === 'default'
      ? Object.fromEntries(
          networkOptionSchema
            .filter((field) => field.type === 'color')
            .map((field) => [field.key, field.default])
        )
      : {};
  const geometry = new Set([
    'layout',
    'geometry',
    'gaps',
    'start',
    'end',
    'middle',
    'size',
    'caption',
  ]);
  const clearsFrame = Object.keys(patch).some(
    (key) =>
      [
        'turns',
        'linkGaps',
        'order',
        'strokeWidth',
        'linecap',
        'linejoin',
        'arrowJoin',
        'balanceArrows',
        'glow',
        'card.inset',
        'card.width',
        'card.radius',
      ].includes(key) ||
      networkOptionSchema.some(
        (field) =>
          field.key === key &&
          field.type !== 'color' &&
          !['title', 'quality'].includes(key) &&
          geometry.has(field.section)
      )
  );
  return normalize({
    ...input,
    ...patch,
    ...palette,
    ...(clearsFrame ? { frame: null } : {}),
    ...(countChanged ? { frame: null, order: null } : {}),
  });
}
