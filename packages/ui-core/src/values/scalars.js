/**
 * Scalar scanners of docs/spec/values.md: numbers, dimensions, durations,
 * hex colours, URLs and token names.
 *
 * Every function reads one token string (an atom the `links-notation` parser
 * already returned) with a small hand-written character scanner. They never
 * read Links Notation structure and use no regular expressions, so no input
 * can trigger catastrophic backtracking.
 */

const isDigit = (c) => c >= '0' && c <= '9';
const isHexDigit = (c) =>
  isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
const isTokenChar = (c) => isDigit(c) || (c >= 'a' && c <= 'z') || c === '-';

/** Index after a run of characters accepted by `accept`, from `i`. */
function skip(text, i, accept) {
  let j = i;
  while (j < text.length && accept(text[j])) {
    j++;
  }
  return j;
}

/**
 * Length of the unsigned decimal at the start of `text` (`12`, `1.5`, `.5`),
 * or -1 when there is none.
 */
function decimalLength(text) {
  const whole = skip(text, 0, isDigit);
  if (text[whole] !== '.') {
    return whole > 0 ? whole : -1;
  }
  const fraction = skip(text, whole + 1, isDigit);
  return fraction > whole + 1 ? fraction : -1;
}

const unsigned = (text) => (text.startsWith('-') ? text.slice(1) : text);

/** `-1`, `0.5`, `.5`, `1e3`, `2.5E-2` */
export function isNumber(text) {
  const body = unsigned(text);
  const length = decimalLength(body);
  if (length < 0) {
    return false;
  }
  if (length === body.length) {
    return true;
  }
  if (body[length] !== 'e' && body[length] !== 'E') {
    return false;
  }
  let exponent = body.slice(length + 1);
  if (exponent.startsWith('-') || exponent.startsWith('+')) {
    exponent = exponent.slice(1);
  }
  return exponent.length > 0 && skip(exponent, 0, isDigit) === exponent.length;
}

/** The units of a `dimension`, in the order of docs/spec/values.md. */
export const DIMENSION_UNITS = Object.freeze([
  'px',
  'rem',
  'em',
  '%',
  'vw',
  'vh',
]);
/** The units of a `duration`. */
export const DURATION_UNITS = Object.freeze(['ms', 's']);
const HEX_LENGTHS = [3, 4, 6, 8];
const URL_PREFIXES = ['http:', 'https:', 'mailto:', '/', '.'];

/**
 * Split `<decimal><unit>` into its number and unit when the unit is one of
 * `units`; `null` otherwise. The sign is part of the number.
 * @param {string} text  `16px`, `-0.5rem`, `150ms`
 * @param {readonly string[]} units
 * @returns {{ value: number, unit: string } | null}
 */
export function splitQuantity(text, units) {
  const body = unsigned(text);
  const length = decimalLength(body);
  const unit = body.slice(length);
  if (length <= 0 || !units.includes(unit)) {
    return null;
  }
  return { value: Number(text.slice(0, text.length - unit.length)), unit };
}

/**
 * A number atom as a JavaScript number, or `null` when it is not one.
 * @param {string} text
 * @returns {number|null}
 */
export const parseNumber = (text) => (isNumber(text) ? Number(text) : null);

/**
 * A `dimension`: a signed number with a unit of {@link DIMENSION_UNITS}, or a
 * bare `0` (given with the empty unit `''`).
 * @param {string} text
 * @returns {{ value: number, unit: string } | null}
 */
export const parseDimension = (text) =>
  text === '0' ? { value: 0, unit: '' } : splitQuantity(text, DIMENSION_UNITS);

/**
 * A `duration`: a non-negative number followed by `ms` or `s`.
 * @param {string} text
 * @returns {{ value: number, unit: string } | null}
 */
export const parseDuration = (text) =>
  text.startsWith('-') ? null : splitQuantity(text, DURATION_UNITS);

export const isDimension = (text) => parseDimension(text) !== null;

export const isDuration = (text) => parseDuration(text) !== null;

/** `#RGB`, `#RGBA`, `#RRGGBB` or `#RRGGBBAA` (the atom, quotes removed). */
export const isHexColour = (text) =>
  text.startsWith('#') &&
  HEX_LENGTHS.includes(text.length - 1) &&
  skip(text, 1, isHexDigit) === text.length;

/** A quoted URL with a known prefix, or a relative path without `:`. */
export const isUrl = (text) =>
  !text.includes(':') || URL_PREFIXES.some((p) => text.startsWith(p));

/** `space.medium`, `colour-1`: lowercase segments joined by dots. */
export const isTokenName = (text) =>
  text
    .split('.')
    .every(
      (part) => part.length > 0 && skip(part, 0, isTokenChar) === part.length
    );

/** `@x` and `$x` are reserved in ui-dialect/0 (docs/spec/values.md). */
export const hasReservedSigil = (text) =>
  text.startsWith('@') || text.startsWith('$');
