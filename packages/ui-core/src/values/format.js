/**
 * Typed values back to text: canonical Links Notation (`formatValue`) and CSS
 * (`toCss`). Links Notation is written by `links-notation` (`Link.format`), so
 * quoting follows the parser exactly; `parseValue` reads one value back with
 * the same parser.
 */

import { Link, Parser } from 'links-notation';
import { valueJson, valueLink } from '../links.js';
import { colorCss, colorRaw } from './color.js';
import { referenceRaw } from './refs.js';

/**
 * @typedef {import('./types.js').TypedValue} TypedValue
 * @typedef {import('../types.js').RawValue} RawValue
 */

const num = (n) => String(n);

/**
 * A typed value as the raw value the projection would give for its canonical
 * text (`{ type: 'dimension', value: 16, unit: 'px' }` -> `'16px'`).
 * @param {TypedValue} value
 * @returns {RawValue}
 */
export function toRaw(value) {
  const reference = referenceRaw(value, toRaw);
  if (reference !== undefined) {
    return reference;
  }
  switch (value.type) {
    case 'dimension':
    case 'duration':
      return `${num(value.value)}${value.unit}`;
    case 'number':
    case 'boolean':
      return num(value.value);
    case 'color':
      return colorRaw(value);
    case 'element-ref':
      return value.id;
    case 'action':
      return [value.name, ...value.args.map(toRaw)];
    case 'list': {
      const items = value.items.map(toRaw);
      return value.id === undefined ? items : { id: value.id, values: items };
    }
    default:
      return value.value; // string, enum, url
  }
}

/**
 * A typed value as canonical Links Notation: `16px`, `'#6750A4'` (hex
 * colours are always quoted), `(token color.primary)`, `'Links UI demo'`.
 * @param {TypedValue} value
 * @returns {string}
 */
export function formatValue(value) {
  const raw = toRaw(value);
  if (typeof raw !== 'string') {
    return valueLink(raw).format();
  }
  // An atom is written as the only value of a link, `(x)` or `('a b')`;
  // its text is that link without the outer parentheses.
  const text = new Link(null, [new Link(raw)]).format();
  return text.slice(1, -1);
}

/**
 * Read the Links Notation text of one value (as written by
 * {@link formatValue}) into the raw form the projection gives: `16px` ->
 * `'16px'`, `'#6750A4'` -> `'#6750A4'`, `(token a.b)` -> `['token', 'a.b']`.
 * @param {string} text
 * @returns {RawValue}
 * @throws {Error} when `text` is not exactly one value
 */
export function parseValue(text) {
  const links = new Parser().parse(`(value ${text})`);
  const values = links.length === 1 ? links[0].values : [];
  if (values.length !== 2) {
    throw new Error(`Expected exactly one Links Notation value: ${text}`);
  }
  return valueJson(values[1]);
}

/** `color.primary` -> `--color-primary`, `draft.text` -> `--param-draft-text`. */
const variableName = (ref) =>
  `--${ref.type === 'param' ? 'param-' : ''}${ref.path.split('.').join('-')}`;

/**
 * The default CSS of a reference: a custom property with an optional
 * fallback.
 * @param {TypedValue} ref  a `token-ref` or `param`
 * @param {string} [fallback]
 */
export const defaultRefToVar = (ref, fallback) =>
  `var(${variableName(ref)}${fallback === undefined ? '' : `, ${fallback}`})`;

const quoteCss = (text) => {
  let out = '"';
  for (const c of text) {
    out += c === '"' || c === '\\' ? `\\${c}` : c;
  }
  return `${out}"`;
};

/** An `(or a b c)` fallback as nested `var(--a, var(--b, c))`. */
function fallbackCss(options, refToVar) {
  let css;
  for (const option of [...options].reverse()) {
    const isRef = option.type === 'token-ref' || option.type === 'param';
    css = isRef ? refToVar(option, css) : toCss(option, { refToVar });
  }
  return css ?? '';
}

/**
 * A typed value as CSS text: `16px`, `150ms`, `#6750A4`, `oklch(0.6 0.2 300)`,
 * `var(--color-primary)`. Actions have no CSS form and give `null`.
 * @param {TypedValue} value
 * @param {import('./types.js').CssOptions} [options]
 * @returns {string|null}
 */
export function toCss(value, { refToVar = defaultRefToVar } = {}) {
  switch (value.type) {
    case 'token-ref':
    case 'param':
      return refToVar(value);
    case 'fallback':
      return fallbackCss(value.options, refToVar);
    case 'color':
      return colorCss(value);
    case 'url':
      return `url(${quoteCss(value.value)})`;
    case 'action':
      return null;
    case 'list':
      return value.items
        .map((item) => toCss(item, { refToVar }))
        .filter((css) => css !== null)
        .join(' ');
    default: {
      const raw = toRaw(value);
      return typeof raw === 'string' ? raw : null;
    }
  }
}
