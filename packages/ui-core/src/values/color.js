/**
 * Colours of docs/spec/values.md: quoted hex (`'#6750A4'`, `'#6750A4CC'`),
 * `(rgb r g b [a])` and `(oklch l c h [a])`, and the oklch <-> sRGB
 * conversion that exporters need for hex output.
 *
 * The conversion uses the OKLab matrices published by Björn Ottosson
 * (https://bottosson.github.io/posts/oklab/) and the sRGB transfer function
 * of IEC 61966-2-1 / CSS Color 4; no third-party code is used.
 */

import { isHexColour, parseNumber } from './scalars.js';

/**
 * @typedef {import('./types.js').SrgbColor} SrgbColor
 * @typedef {import('./types.js').OklchColor} OklchColor
 * @typedef {import('./types.js').Color} Color
 */

const HEX_DIGITS = '0123456789ABCDEF';

/** `'a'` -> 10; the character is a checked hex digit. */
const hexValue = (c) => HEX_DIGITS.indexOf(c.toUpperCase());

/**
 * Read one colour channel: a number, or a percentage of `percentOf`.
 * @returns {number|null}
 */
function channel(text, percentOf) {
  if (typeof text !== 'string') {
    return null;
  }
  if (text.endsWith('%')) {
    const percent = parseNumber(text.slice(0, -1));
    return percent === null ? null : (percent / 100) * percentOf;
  }
  return parseNumber(text);
}

/**
 * Channel scales of the colour functions: what 100% means for each channel
 * and how a plain number maps to the typed value.
 * - `rgb`: channels 0..255 (100% = 255) are stored as 0..1; alpha 0..1.
 * - `oklch`: `l` 0..1 (100% = 1), `c` (100% = 0.4, as in CSS Color 4),
 *   `h` in degrees (100% = one turn, 360), alpha 0..1.
 */
const FUNCTIONS = {
  rgb: {
    names: ['r', 'g', 'b'],
    percentOf: [255, 255, 255],
    scale: 255,
  },
  oklch: {
    names: ['l', 'c', 'h'],
    percentOf: [1, 0.4, 360],
    scale: 1,
  },
};

function parseHex(text) {
  const digits = text.slice(1);
  const pairs =
    digits.length <= 4
      ? [...digits].map((c) => hexValue(c) * 17)
      : [0, 2, 4, 6]
          .filter((i) => i < digits.length)
          .map((i) => hexValue(digits[i]) * 16 + hexValue(digits[i + 1]));
  const [r, g, b, a = 255] = pairs;
  return {
    type: 'color',
    space: 'srgb',
    r: r / 255,
    g: g / 255,
    b: b / 255,
    a: a / 255,
  };
}

function parseFunction([name, ...texts]) {
  const spec =
    typeof name === 'string' && Object.hasOwn(FUNCTIONS, name)
      ? FUNCTIONS[name]
      : undefined;
  if (spec === undefined || (texts.length !== 3 && texts.length !== 4)) {
    return null;
  }
  const numbers = texts.map((text, i) => channel(text, spec.percentOf[i] ?? 1));
  if (numbers.includes(null)) {
    return null;
  }
  const [x, y, z, a = 1] = numbers;
  const [nx, ny, nz] = spec.names;
  return {
    type: 'color',
    space: name === 'rgb' ? 'srgb' : 'oklch',
    [nx]: x / spec.scale,
    [ny]: y / spec.scale,
    [nz]: z / spec.scale,
    a,
  };
}

/**
 * Read a colour value as the projection gives it: a hex atom (`'#6750A4'`
 * is the atom `#6750A4`) or a link `['oklch', '0.6', '0.2', '300']`.
 * @param {import('../types.js').RawValue} raw
 * @returns {Color|null} `null` when `raw` is not a colour
 */
export function parseColor(raw) {
  if (typeof raw === 'string') {
    return isHexColour(raw) ? parseHex(raw) : null;
  }
  return Array.isArray(raw) ? parseFunction(raw) : null;
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const byte = (x) => Math.round(clamp01(x) * 255);
const hexByte = (x) => {
  const n = byte(x);
  return HEX_DIGITS[n >> 4] + HEX_DIGITS[n & 15];
};

/** Whether `x` (0..1) is exactly one of the 256 values of a hex byte. */
const isByte = (x) =>
  x >= 0 && x <= 1 && Math.abs(x * 255 - Math.round(x * 255)) < 1e-9;

/**
 * An sRGB colour as `#RRGGBB`, or `#RRGGBBAA` when it is not opaque. An
 * oklch colour is converted first; every channel is clamped to 0..1.
 * @param {Color} color
 * @returns {string} upper-case hex, `#FFFFFF`
 */
export function toHex(color) {
  const { r, g, b, a } = color.space === 'oklch' ? oklchToSrgb(color) : color;
  const alpha = byte(a) === 255 ? '' : hexByte(a);
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}${alpha}`;
}

/** Shortest text of a number that reads back as the same number. */
const num = (n) => String(n);

/**
 * The canonical raw form of a colour: a hex atom when the sRGB channels are
 * exact bytes, otherwise a `rgb` or `oklch` link. The alpha channel is
 * written only when it is not 1.
 * @param {Color} color
 * @returns {import('../types.js').RawValue}
 */
export function colorRaw(color) {
  const alpha = color.a === 1 ? [] : [num(color.a)];
  if (color.space === 'oklch') {
    return ['oklch', num(color.l), num(color.c), num(color.h), ...alpha];
  }
  const { r, g, b, a } = color;
  if ([r, g, b, a].every(isByte)) {
    return toHex(color);
  }
  return ['rgb', num(r * 255), num(g * 255), num(b * 255), ...alpha];
}

/**
 * A colour as canonical Links Notation: `'#6750A4'` (always quoted, because
 * a bare `#` starts a comment), `(rgb 127.5 0 0)` or `(oklch 0.6 0.2 300)`.
 * @param {Color} color
 * @returns {string}
 */
export function formatColor(color) {
  const raw = colorRaw(color);
  return typeof raw === 'string' ? `'${raw}'` : `(${raw.join(' ')})`;
}

/**
 * A colour as CSS text: hex when it fits, else `rgb(r g b / a)` or
 * `oklch(l c h / a)`.
 * @param {Color} color
 * @returns {string}
 */
export function colorCss(color) {
  const raw = colorRaw(color);
  if (typeof raw === 'string') {
    return raw;
  }
  const [name, x, y, z, a] = raw;
  return `${name}(${x} ${y} ${z}${a === undefined ? '' : ` / ${a}`})`;
}

const encode = (x) =>
  Math.abs(x) <= 0.0031308
    ? 12.92 * x
    : Math.sign(x) * (1.055 * Math.abs(x) ** (1 / 2.4) - 0.055);

const decode = (x) =>
  Math.abs(x) <= 0.04045
    ? x / 12.92
    : Math.sign(x) * ((Math.abs(x) + 0.055) / 1.055) ** 2.4;

const multiply = (m, [x, y, z]) => m.map(([p, q, s]) => p * x + q * y + s * z);

/* OKLab matrices (Björn Ottosson, "A perceptual color space for image
   processing", 2020). */
const LMS_TO_SRGB = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];
const OKLAB_TO_LMS = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
];
const SRGB_TO_LMS = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const LMS_TO_OKLAB = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];

/** Below this chroma the hue is meaningless and is given as 0. */
const ACHROMATIC = 1e-7;

/**
 * oklch -> sRGB (gamma-encoded, channels 0..1). Out-of-gamut colours give
 * channels outside 0..1; {@link toHex} clamps them.
 * @param {OklchColor} color
 * @returns {SrgbColor}
 */
export function oklchToSrgb({ l, c, h, a }) {
  const angle = (h * Math.PI) / 180;
  const lab = [l, c * Math.cos(angle), c * Math.sin(angle)];
  const lms = multiply(OKLAB_TO_LMS, lab).map((x) => x ** 3);
  const [r, g, b] = multiply(LMS_TO_SRGB, lms).map(encode);
  return { type: 'color', space: 'srgb', r, g, b, a };
}

/**
 * sRGB -> oklch; the hue is in degrees, 0 <= h < 360 (0 for greys).
 * @param {SrgbColor} color
 * @returns {OklchColor}
 */
export function srgbToOklch({ r, g, b, a }) {
  const lms = multiply(SRGB_TO_LMS, [r, g, b].map(decode)).map(Math.cbrt);
  const [l, x, y] = multiply(LMS_TO_OKLAB, lms);
  const c = Math.hypot(x, y);
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  const h = c < ACHROMATIC ? 0 : (degrees + 360) % 360;
  return { type: 'color', space: 'oklch', l, c, h, a };
}
