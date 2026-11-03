/**
 * Animated values: reading the value of a key, resolving token references,
 * interpolating two values and writing a value as CSS text.
 *
 * - numbers (`0.96`) interpolate linearly and are output as numbers;
 * - colours (`'#FF0000'`, `(oklch ...)`, `(rgb ...)`) interpolate in OKLCH
 *   along the shorter hue arc and are output as CSS text;
 * - any other text (`'0 8px'`, `'inset(0 0 100% 0)'`) is scanned into a
 *   skeleton of text and quantities; two texts with the same skeleton
 *   interpolate quantity by quantity (a bare `0` takes the unit of the other
 *   side), any other pair switches discretely at progress 0.5, as CSS does.
 *
 * Text is scanned character by character; no regular expressions.
 */

import { values as coreValues } from '@link-foundation/ui-core';
import { cssNumber } from './easing.js';
import { unwrapToken } from './tokens.js';

const { parseColor, parseNumber, colorCss, oklchToSrgb, srgbToOklch } =
  coreValues;

/**
 * @typedef {{ type: 'number', value: number }
 *   | { type: 'color', color: import('@link-foundation/ui-core').values.Color }
 *   | { type: 'text', parts: (string | { value: number, unit: string })[] }
 *   | { type: 'token', path: string }} AnimValue
 */

const isDigit = (c) => c >= '0' && c <= '9';
const isLetter = (c) =>
  (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
const isUnitChar = (c) => isLetter(c) || c === '%';

/** Whether a number starts at `i` of `text`. */
function numberStarts(text, i) {
  const previous = text[i - 1];
  if (previous !== undefined && (isLetter(previous) || isDigit(previous))) {
    return false;
  }
  let j = i;
  if (text[j] === '-' || text[j] === '+') {
    j++;
  }
  if (text[j] === '.') {
    j++;
  }
  return isDigit(text[j] ?? '');
}

/** The end index of the number that starts at `i`. */
function numberEnd(text, i) {
  let j = i;
  if (text[j] === '-' || text[j] === '+') {
    j++;
  }
  while (isDigit(text[j] ?? '')) {
    j++;
  }
  if (text[j] === '.') {
    j++;
    while (isDigit(text[j] ?? '')) {
      j++;
    }
  }
  return j;
}

/**
 * Scan CSS-like text into text parts and quantities:
 * `'inset(0 0 100% 0)'` -> `['inset(', {0,''}, ' ', ..., {100,'%'}, ...]`.
 * @param {string} text
 */
export function scanText(text) {
  const parts = [];
  let literal = '';
  let i = 0;
  while (i < text.length) {
    if (!numberStarts(text, i)) {
      literal += text[i];
      i++;
      continue;
    }
    const end = numberEnd(text, i);
    let unitEnd = end;
    while (unitEnd < text.length && isUnitChar(text[unitEnd])) {
      unitEnd++;
    }
    parts.push(literal);
    literal = '';
    parts.push({
      value: Number(text.slice(i, end)),
      unit: text.slice(end, unitEnd),
    });
    i = unitEnd;
  }
  parts.push(literal);
  return parts;
}

/**
 * Read the raw value of a key (as the ui-core projection gives it).
 * @param {import('@link-foundation/ui-core').RawValue} raw
 * @returns {AnimValue|null} `null` when it is not a value
 */
export function readValue(raw) {
  if (typeof raw === 'string') {
    const n = parseNumber(raw);
    if (n !== null) {
      return { type: 'number', value: n };
    }
    const color = parseColor(raw);
    return color
      ? { type: 'color', color }
      : { type: 'text', parts: scanText(raw) };
  }
  if (Array.isArray(raw)) {
    if (raw[0] === 'token' && raw.length === 2 && typeof raw[1] === 'string') {
      return { type: 'token', path: raw[1] };
    }
    const color = parseColor(raw);
    return color ? { type: 'color', color } : null;
  }
  return null;
}

/** The CSS variable of a token path: `color.primary` -> `--color-primary`. */
const tokenVariable = (path) => `var(--${path.split('.').join('-')})`;

/**
 * A resolved token (a ui-tokens typed value) as an animated value.
 * @returns {AnimValue|null}
 */
function fromToken(resolved) {
  const token = unwrapToken(resolved);
  if (token === undefined || token === null) {
    return null;
  }
  if (typeof token === 'number') {
    return { type: 'number', value: token };
  }
  if (typeof token === 'string') {
    return readValue(token);
  }
  switch (token.type) {
    case 'color':
      return { type: 'color', color: token };
    case 'number':
      return { type: 'number', value: token.value };
    case 'dimension':
    case 'duration':
      return {
        type: 'text',
        parts: ['', { value: token.value, unit: token.unit }, ''],
      };
    default:
      return typeof token.value === 'string' ? readValue(token.value) : null;
  }
}

/**
 * Resolve a token reference with `resolveToken`; other values are returned
 * as they are, and an unknown token stays a reference (CSS `var(--...)`).
 * @param {AnimValue} value
 * @param {(path: string) => unknown} [resolveToken]
 * @returns {AnimValue}
 */
export function resolveValue(value, resolveToken) {
  if (value.type !== 'token') {
    return value;
  }
  return fromToken(resolveToken?.(value.path)) ?? value;
}

const lerp = (a, b, p) => a + (b - a) * p;

/** The shortest signed hue difference from `a` to `b`, in degrees. */
function hueDelta(a, b) {
  const d = (((b - a) % 360) + 540) % 360;
  return d - 180;
}

function asOklch(color) {
  return color.space === 'oklch' ? color : srgbToOklch(color);
}

function mixColors(from, to, p) {
  const a = asOklch(from);
  const b = asOklch(to);
  // A grey has no hue: it takes the hue of the other colour.
  const ha = a.c < 1e-4 ? b.h : a.h;
  const hb = b.c < 1e-4 ? ha : b.h;
  const h = (((ha + hueDelta(ha, hb) * p) % 360) + 360) % 360;
  return {
    type: 'color',
    space: 'oklch',
    l: lerp(a.l, b.l, p),
    c: lerp(a.c, b.c, p),
    h,
    a: lerp(a.a, b.a, p),
  };
}

const quantity = (part) => typeof part === 'object';

/** Whether two scanned texts can interpolate quantity by quantity. */
function sameSkeleton(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((part, i) => {
    const other = b[i];
    if (!quantity(part) || !quantity(other)) {
      return part === other;
    }
    return (
      part.unit === other.unit ||
      (part.unit === '' && part.value === 0) ||
      (other.unit === '' && other.value === 0)
    );
  });
}

function mixTexts(a, b, p) {
  return a.map((part, i) => {
    if (!quantity(part)) {
      return part;
    }
    const other = b[i];
    return {
      value: lerp(part.value, other.value, p),
      unit: part.unit || other.unit,
    };
  });
}

/**
 * Interpolate two resolved values at progress `p` (eased, may overshoot).
 * @param {AnimValue} from
 * @param {AnimValue} to
 * @param {number} p
 * @returns {AnimValue}
 */
export function interpolate(from, to, p) {
  if (from.type === 'number' && to.type === 'number') {
    return { type: 'number', value: lerp(from.value, to.value, p) };
  }
  if (from.type === 'color' && to.type === 'color') {
    return { type: 'color', color: mixColors(from.color, to.color, p) };
  }
  if (from.type === 'number' && to.type === 'text') {
    return interpolate(numberText(from), to, p);
  }
  if (from.type === 'text' && to.type === 'number') {
    return interpolate(from, numberText(to), p);
  }
  if (
    from.type === 'text' &&
    to.type === 'text' &&
    sameSkeleton(from.parts, to.parts)
  ) {
    return { type: 'text', parts: mixTexts(from.parts, to.parts, p) };
  }
  return p < 0.5 ? from : to;
}

const numberText = (n) => ({
  type: 'text',
  parts: ['', { value: n.value, unit: '' }, ''],
});

/**
 * A resolved value as CSS text (`'0.96'`, `'0 8px'`, `'#FF0000'`).
 * @param {AnimValue} value
 * @returns {string}
 */
export function valueCss(value) {
  switch (value.type) {
    case 'number':
      return cssNumber(value.value);
    case 'color':
      return colorCss(roundColor(value.color));
    case 'token':
      return tokenVariable(value.path);
    default:
      return value.parts
        .map((part) =>
          quantity(part) ? `${cssNumber(part.value)}${part.unit}` : part
        )
        .join('');
  }
}

function roundColor(color) {
  const round = (x) => Math.round(x * 10000) / 10000;
  if (color.space === 'oklch') {
    return {
      ...color,
      l: round(color.l),
      c: round(color.c),
      h: round(color.h),
      a: round(color.a),
    };
  }
  return color;
}

/**
 * A resolved value as the output of `sample`: a number stays a number, any
 * other value is CSS text.
 * @param {AnimValue} value
 * @returns {number|string}
 */
export function outputValue(value) {
  return value.type === 'number' ? value.value : valueCss(value);
}

/**
 * The WCAG 2 relative luminance of a colour (0 black .. 1 white), with its
 * alpha over black.
 * @param {import('@link-foundation/ui-core').values.Color} color
 */
export function relativeLuminance(color) {
  const { r, g, b, a } = color.space === 'oklch' ? oklchToSrgb(color) : color;
  const linear = (x) => {
    const c = Math.min(1, Math.max(0, x));
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return y * Math.min(1, Math.max(0, a));
}
