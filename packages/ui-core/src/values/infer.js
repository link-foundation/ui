/**
 * `inferValue(raw)`: lexical typing for values that no vocabulary type
 * describes (`any` properties, unknown kinds). The parser drops quotes, so
 * `'1'` and `1` both infer as a number; declared types always win
 * (docs/spec/values.md, "Typing is schema-driven").
 */

import { parseColor } from './color.js';
import { parseReference } from './refs.js';
import { parseDimension, parseDuration, parseNumber } from './scalars.js';

/**
 * @param {string} text
 * @returns {import('./types.js').TypedValue}
 */
function inferAtom(text) {
  const number = parseNumber(text);
  if (number !== null) {
    return { type: 'number', value: number };
  }
  const dimension = parseDimension(text);
  if (dimension !== null) {
    return { type: 'dimension', ...dimension };
  }
  const duration = parseDuration(text);
  if (duration !== null) {
    return { type: 'duration', ...duration };
  }
  return parseColor(text) ?? { type: 'string', value: text };
}

const list = (values, id) => ({
  type: 'list',
  items: values.map(inferValue),
  ...(id === undefined ? {} : { id }),
});

/**
 * Infer a typed value from its spelling: a number, `16px` / `150ms`, a hex
 * colour, `(token ...)`, `(param ...)`, `(or ...)`, `(oklch ...)` /
 * `(rgb ...)`; any other atom is a `string` and any other link a `list`.
 * Never fails.
 * @param {import('../types.js').RawValue} raw
 * @returns {import('./types.js').TypedValue}
 */
export function inferValue(raw) {
  if (typeof raw === 'string') {
    return inferAtom(raw);
  }
  if (!Array.isArray(raw)) {
    return list(raw.values, raw.id);
  }
  return parseReference(raw, inferValue) ?? parseColor(raw) ?? list(raw);
}
