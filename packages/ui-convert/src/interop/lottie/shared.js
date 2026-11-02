/**
 * What the Lottie importer and exporter share: the mapping table, the
 * transform properties and their units, numbers, colours and easings.
 */

import { loadMapping } from '../mapping.js';
import { isObject } from '../safety.js';

/** The format name used in `(source ...)`, `(extra ...)` and diagnostics. */
export const FORMAT = 'lottie';

/** The Lottie specification version the mapping follows. */
export const LOTTIE_VERSION = '1.0';

/** The mapping table (mapping.lino). */
export const mapping = loadMapping(import.meta.url);

/**
 * The animatable transform properties of layers (`ks`) and of shape
 * groups (`tr`): the Lottie key, the track or property name, the unit
 * written after every component and the factor Lottie values are divided
 * by (Lottie opacity and scale are percentages).
 */
export const TRANSFORM = [
  { key: 'a', name: 'anchor', unit: 'px', factor: 1, vector: true },
  { key: 'p', name: 'translate', unit: 'px', factor: 1, vector: true },
  { key: 's', name: 'scale', unit: '', factor: 100, vector: true },
  { key: 'r', name: 'rotate', unit: 'deg', factor: 1, vector: false },
  { key: 'o', name: 'opacity', unit: '', factor: 100, vector: false },
  { key: 'sk', name: 'skew', unit: 'deg', factor: 1, vector: false },
  { key: 'sa', name: 'skew-axis', unit: 'deg', factor: 1, vector: false },
];

/** Round away binary floating point noise (12 significant digits). */
export const tidy = (n) => Number(Number(n).toPrecision(12));

/** A number as LiNo text, exactly. */
export const num = (n) => String(n);

/** A computed number as LiNo text, without floating point noise. */
export const tidyNum = (n) => String(tidy(n));

/**
 * Encode a transform value (a number or a vector) with its unit.
 * @param {{ unit: string, factor: number }} spec
 * @param {number|number[]} value
 */
export function encodeTransform(spec, value) {
  const list = Array.isArray(value) ? value : [value];
  const scaled = (n) => (spec.factor === 1 ? num(n) : tidyNum(n / spec.factor));
  return list.map((n) => `${scaled(n)}${spec.unit}`).join(' ');
}

/**
 * Decode a value written by {@link encodeTransform}, as a vector, or
 * `null` when a component is not a number with the unit.
 * @param {{ unit: string, factor: number }} spec
 * @param {unknown} text
 * @returns {number[]|null}
 */
export function decodeTransform(spec, text) {
  if (typeof text !== 'string') {
    return null;
  }
  const out = [];
  for (const part of text.split(' ').filter(Boolean)) {
    if (!part.endsWith(spec.unit)) {
      return null;
    }
    const n = Number(part.slice(0, part.length - spec.unit.length));
    if (!Number.isFinite(n) || part === spec.unit) {
      return null;
    }
    out.push(spec.factor === 1 ? n : tidy(n * spec.factor));
  }
  return out.length > 0 ? out : null;
}

/**
 * Whether a transform value reads back unchanged from its LiNo text.
 * @param {{ unit: string, factor: number }} spec
 * @param {number|number[]} value
 */
export function transformRoundTrips(spec, value) {
  const back = decodeTransform(spec, encodeTransform(spec, value));
  const list = Array.isArray(value) ? value : [value];
  return (
    back !== null &&
    back.length === list.length &&
    back.every((n, i) => n === list[i])
  );
}

/** Whether a number list is a Lottie vector. */
export const isVector = (v) =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((n) => typeof n === 'number' && Number.isFinite(n));

/** Whether a value is a finite number. */
export const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

const HEX = '0123456789ABCDEF';

/**
 * A Lottie colour (`[r, g, b]` or `[r, g, b, a]` in 0..1) as `#RRGGBB` or
 * `#RRGGBBAA` when that is exact, otherwise as its JSON text.
 * @param {number[]} colour
 */
export function encodeColour(colour) {
  const exact =
    (colour.length === 3 || colour.length === 4) &&
    colour.every((c) => c >= 0 && c <= 1 && Math.round(c * 255) / 255 === c);
  if (!exact) {
    return JSON.stringify(colour);
  }
  const byte = (c) => {
    const n = Math.round(c * 255);
    return HEX[Math.floor(n / 16)] + HEX[n % 16];
  };
  return `#${colour.map(byte).join('')}`;
}

/**
 * Decode a colour written by {@link encodeColour} (or a `#RGB` colour).
 * @param {unknown} text
 * @returns {number[]|null}
 */
export function decodeColour(text) {
  if (typeof text !== 'string') {
    return null;
  }
  if (!text.startsWith('#')) {
    try {
      const value = JSON.parse(text);
      return isVector(value) ? value : null;
    } catch {
      return null;
    }
  }
  let digits = text.slice(1).toUpperCase();
  if (digits.length === 3 || digits.length === 4) {
    digits = [...digits].map((d) => d + d).join('');
  }
  if (
    (digits.length !== 6 && digits.length !== 8) ||
    ![...digits].every((d) => HEX.includes(d))
  ) {
    return null;
  }
  const out = [];
  for (let i = 0; i < digits.length; i += 2) {
    out.push((HEX.indexOf(digits[i]) * 16 + HEX.indexOf(digits[i + 1])) / 255);
  }
  return out;
}

/**
 * A static animatable property: `{ a: 0, k }` (or `{ k }`) with no other
 * key than `ix`. Returns the value, or `undefined`.
 * @param {unknown} property
 */
export function staticValue(property) {
  if (!isObject(property) || property.a === 1 || !('k' in property)) {
    return undefined;
  }
  const keys = Object.keys(property).filter((k) => k !== 'ix');
  return keys.every((k) => k === 'a' || k === 'k') ? property.k : undefined;
}

/** Whether an animatable property is animated: `{ a: 1, k: [...] }`. */
export const isAnimated = (property) =>
  isObject(property) && property.a === 1 && Array.isArray(property.k);

/**
 * The cubic-bezier of the ui-core easing names, for keys without their own
 * easing.
 */
export const NAMED_EASINGS = {
  linear: [0, 0, 1, 1],
  standard: [0.2, 0, 0, 1],
  emphasized: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0, 1],
  accelerate: [0.3, 0, 1, 1],
};

/**
 * Walk a JSON value and call `visit(object, path)` for every object.
 * @param {unknown} value
 * @param {(object: Record<string, unknown>, path: string) => void} visit
 * @param {string} [path]
 */
export function walkJson(value, visit, path = '') {
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkJson(v, visit, `${path}/${i}`));
  } else if (isObject(value)) {
    visit(value, path);
    for (const [key, inner] of Object.entries(value)) {
      walkJson(inner, visit, `${path}/${key}`);
    }
  }
}
