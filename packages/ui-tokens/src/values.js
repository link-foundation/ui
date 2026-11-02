/**
 * Token values: typing the Links Notation value of a `(token PATH VALUE)`
 * link and writing it back. Primitive values (colours, dimensions,
 * durations, numbers, `(token ...)` aliases) are the typed values of
 * `@link-foundation/ui-core` (#15); the DTCG-only types (`fontFamily`,
 * `fontWeight`, `cubicBezier`) and the composites (`shadow`, `typography`)
 * are added here.
 */

import { values as coreValues } from '@link-foundation/ui-core';

const { parseColor, parseDimension, parseDuration, parseNumber, toRaw } =
  coreValues;

/**
 * @typedef {import('@link-foundation/ui-core').RawValue} RawValue
 * @typedef {import('./types.js').TokenValue} TokenValue
 */

/** Every token type, in the order of the README. */
export const TOKEN_TYPES = Object.freeze([
  'color',
  'dimension',
  'duration',
  'number',
  'fontFamily',
  'fontWeight',
  'cubicBezier',
  'shadow',
  'typography',
]);

/**
 * The named font weights of DTCG 2025.10, section 8.4 "Font weight":
 * "The value must either be a number value in the range [1, 1000] or one of
 * the pre-defined string values defined in the table below."
 */
export const FONT_WEIGHTS = Object.freeze({
  thin: 100,
  hairline: 100,
  'extra-light': 200,
  'ultra-light': 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  'semi-bold': 600,
  'demi-bold': 600,
  bold: 700,
  'extra-bold': 800,
  'ultra-bold': 800,
  black: 900,
  heavy: 900,
  'extra-black': 950,
  'ultra-black': 950,
});

/**
 * Fields of the composites: the Links Notation name, the DTCG name and the
 * type of the field value (DTCG 2025.10 sections 9.6 "Shadow" and 9.8
 * "Typography").
 */
export const COMPOSITE_FIELDS = Object.freeze({
  shadow: Object.freeze([
    ['color', 'color', 'color'],
    ['offset-x', 'offsetX', 'dimension'],
    ['offset-y', 'offsetY', 'dimension'],
    ['blur', 'blur', 'dimension'],
    ['spread', 'spread', 'dimension'],
  ]),
  typography: Object.freeze([
    ['font-family', 'fontFamily', 'fontFamily'],
    ['font-size', 'fontSize', 'dimension'],
    ['font-weight', 'fontWeight', 'fontWeight'],
    ['letter-spacing', 'letterSpacing', 'dimension'],
    ['line-height', 'lineHeight', 'number'],
  ]),
});

const isAtom = (raw) => typeof raw === 'string';
const isLink = (raw) => Array.isArray(raw);
const headOf = (raw) => (isLink(raw) && isAtom(raw[0]) ? raw[0] : null);

/** `(token a.b)`: an alias of another token. */
export function parseAlias(raw) {
  return headOf(raw) === 'token' && raw.length === 2 && isAtom(raw[1])
    ? { type: 'token-ref', path: raw[1] }
    : null;
}

const quantity = (type, parsed) =>
  parsed === null ? null : { type, value: parsed.value, unit: parsed.unit };

/**
 * The units of a dimension token: DTCG 2025.10 section 8.2 "Dimension":
 * "unit: ... MUST be one of the following: px, rem" (ui-core also knows
 * `em`, `%`, `vw` and `vh`, which have no meaning on other platforms).
 */
export const DIMENSION_UNITS = Object.freeze(['px', 'rem']);

/** A dimension in px or rem; a unitless `0` is `0px`. */
function parseTokenDimension(raw) {
  const parsed = isAtom(raw) ? parseDimension(raw) : null;
  if (parsed === null) {
    return null;
  }
  const unit = parsed.unit === '' ? 'px' : parsed.unit;
  return DIMENSION_UNITS.includes(unit)
    ? { type: 'dimension', value: parsed.value, unit }
    : null;
}

/** Heads of the function-like values; a list with one is no font family. */
const VALUE_HEADS = new Set([
  'token',
  'cubic-bezier',
  'shadow',
  'typography',
  'oklch',
  'rgb',
  'rgba',
  'hsl',
  'hsla',
]);

function parseFontFamily(raw) {
  if (isAtom(raw)) {
    return { type: 'fontFamily', value: raw };
  }
  return isLink(raw) &&
    raw.length > 0 &&
    raw.every(isAtom) &&
    !VALUE_HEADS.has(raw[0])
    ? { type: 'fontFamily', value: [...raw] }
    : null;
}

/**
 * An undeclared font family: no name may look like a quantity (`12em`,
 * `50%`): such a name is a mistyped dimension, not a family.
 */
function inferFontFamily(raw) {
  const value = parseFontFamily(raw);
  const names = value === null ? [] : [value.value].flat();
  return names.some((name) => parseDimension(name) !== null) ? null : value;
}

function parseFontWeight(raw) {
  if (!isAtom(raw)) {
    return null;
  }
  if (Object.hasOwn(FONT_WEIGHTS, raw)) {
    return { type: 'fontWeight', value: raw };
  }
  const n = parseNumber(raw);
  return n !== null && n >= 1 && n <= 1000
    ? { type: 'fontWeight', value: n }
    : null;
}

function parseCubicBezier(raw) {
  if (headOf(raw) !== 'cubic-bezier' || raw.length !== 5) {
    return null;
  }
  const points = raw.slice(1).map((p) => (isAtom(p) ? parseNumber(p) : null));
  const inRange = (x) => x !== null && x >= 0 && x <= 1;
  return points.every((p) => p !== null) &&
    inRange(points[0]) &&
    inRange(points[2])
    ? { type: 'cubicBezier', value: points }
    : null;
}

/** The field links of a composite as `name -> raw value`. */
function fieldMap(links) {
  const fields = new Map();
  for (const link of links) {
    if (!isLink(link) || !isAtom(link[0]) || link.length < 2) {
      return null;
    }
    fields.set(link[0], link.length === 2 ? link[1] : link.slice(1));
  }
  return fields;
}

/**
 * A composite object: every field typed with its field type (or an alias).
 * @returns {Record<string, TokenValue>|null}
 */
function parseFields(kind, links, extra = []) {
  const fields = fieldMap(links);
  if (fields === null) {
    return null;
  }
  const out = {};
  for (const [name, key, type] of COMPOSITE_FIELDS[kind]) {
    const raw = fields.get(name);
    const value = raw === undefined ? null : typeTokenValue(raw, type);
    if (value === null) {
      return null;
    }
    out[key] = value;
    fields.delete(name);
  }
  for (const name of extra) {
    fields.delete(name);
  }
  return fields.size === 0 ? out : null;
}

function parseShadowLayer(raw) {
  if (headOf(raw) !== 'shadow') {
    return parseAlias(raw);
  }
  const layer = parseFields('shadow', raw.slice(1), ['inset']);
  if (layer === null) {
    return null;
  }
  const inset = fieldMap(raw.slice(1)).get('inset');
  if (inset !== undefined) {
    if (inset !== 'true' && inset !== 'false') {
      return null;
    }
    layer.inset = inset === 'true';
  }
  return layer;
}

function parseShadow(raw) {
  if (headOf(raw) === 'shadow') {
    const layer = parseShadowLayer(raw);
    return layer === null ? null : { type: 'shadow', value: layer };
  }
  if (!isLink(raw) || raw.length === 0 || headOf(raw) !== null) {
    return null;
  }
  const layers = raw.map(parseShadowLayer);
  return layers.includes(null) ? null : { type: 'shadow', value: layers };
}

function parseTypography(raw) {
  if (headOf(raw) !== 'typography') {
    return null;
  }
  const value = parseFields('typography', raw.slice(1));
  return value === null ? null : { type: 'typography', value };
}

/** Readers of a declared type: raw value -> token value or `null`. */
const READERS = {
  color: parseColor,
  dimension: parseTokenDimension,
  duration: (raw) =>
    isAtom(raw) ? quantity('duration', parseDuration(raw)) : null,
  number: (raw) => {
    const value = isAtom(raw) ? parseNumber(raw) : null;
    return value === null ? null : { type: 'number', value };
  },
  fontFamily: parseFontFamily,
  fontWeight: parseFontWeight,
  cubicBezier: parseCubicBezier,
  shadow: parseShadow,
  typography: parseTypography,
};

/** The order in which an undeclared value is tried; `fontFamily` is last. */
const INFER_ORDER = [
  'number',
  'dimension',
  'duration',
  'color',
  'fontWeight',
  'cubicBezier',
  'shadow',
  'typography',
  'fontFamily',
];

/**
 * Type the value of a token.
 *
 * With a declared type the value must be of that type. Without one the type
 * is read from the spelling: `16px` is a dimension, `150ms` a duration,
 * `'#6750A4'` and `(oklch ...)` colours, `1.5` a number, `bold` a font
 * weight, `(cubic-bezier ...)`, `(shadow ...)` and `(typography ...)` are
 * what they say, and any other atom or a list of atoms is a font family.
 * An alias `(token a.b)` is accepted with any declared type; the resolver
 * checks it against the type of its target.
 * @param {RawValue} raw
 * @param {string} [declared]  one of {@link TOKEN_TYPES}
 * @returns {TokenValue|null} `null` when the value is invalid
 */
export function typeTokenValue(raw, declared) {
  const alias = parseAlias(raw);
  if (alias !== null) {
    return alias;
  }
  if (declared !== undefined) {
    return Object.hasOwn(READERS, declared) ? READERS[declared](raw) : null;
  }
  for (const type of INFER_ORDER) {
    const value =
      type === 'fontFamily' ? inferFontFamily(raw) : READERS[type](raw);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

const num = (n) => String(n);

function fieldsRaw(kind, object) {
  return COMPOSITE_FIELDS[kind].map(([name, key]) => {
    const raw = tokenValueRaw(object[key]);
    return isLink(raw) && headOf(raw) === null && raw.every(isAtom)
      ? [name, ...raw]
      : [name, raw];
  });
}

function shadowLayerRaw(layer) {
  if (layer.type === 'token-ref') {
    return toRaw(layer);
  }
  const inset =
    layer.inset === undefined ? [] : [['inset', String(layer.inset)]];
  return ['shadow', ...fieldsRaw('shadow', layer), ...inset];
}

/**
 * A token value as the raw Links Notation value it is written as; the
 * inverse of {@link typeTokenValue}.
 * @param {TokenValue} value
 * @returns {RawValue}
 */
export function tokenValueRaw(value) {
  switch (value.type) {
    case 'fontFamily':
      return Array.isArray(value.value) ? [...value.value] : value.value;
    case 'fontWeight':
      return num(value.value);
    case 'cubicBezier':
      return ['cubic-bezier', ...value.value.map(num)];
    case 'shadow':
      return Array.isArray(value.value)
        ? value.value.map(shadowLayerRaw)
        : shadowLayerRaw(value.value);
    case 'typography':
      return ['typography', ...fieldsRaw('typography', value.value)];
    default:
      return toRaw(value);
  }
}

/**
 * The type a value would be inferred as without `(type ...)`, used to
 * decide when the writers must spell the type out.
 * @param {RawValue} raw
 * @returns {string|null}
 */
export function inferredType(raw) {
  return typeTokenValue(raw)?.type ?? null;
}

/**
 * Replace every alias inside a composite (a field, or a layer of a shadow)
 * with `replace(ref, type)`, where `type` is the type the alias must
 * resolve to. A shadow layer that is an alias of a shadow token is replaced
 * by the layers of that token. Other values are returned unchanged.
 * @param {TokenValue} value
 * @param {(ref: { type: 'token-ref', path: string }, type: string) => TokenValue} replace
 * @returns {TokenValue}
 */
export function mapNestedAliases(value, replace) {
  const fields = (kind, object) => {
    const out = { ...object };
    for (const [, key, type] of COMPOSITE_FIELDS[kind]) {
      if (object[key].type === 'token-ref') {
        out[key] = replace(object[key], type);
      }
    }
    return out;
  };
  if (value.type === 'typography') {
    return { ...value, value: fields('typography', value.value) };
  }
  if (value.type !== 'shadow') {
    return value;
  }
  const layer = (l) => {
    if (l.type !== 'token-ref') {
      return fields('shadow', l);
    }
    const target = replace(l, 'shadow');
    return target.type === 'shadow' ? target.value : l;
  };
  return Array.isArray(value.value)
    ? { ...value, value: value.value.flatMap(layer) }
    : { ...value, value: layer(value.value) };
}
