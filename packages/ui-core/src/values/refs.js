/**
 * References of docs/spec/values.md: `(token color.primary)`,
 * `(param draft.text)`, fallbacks `(or (token a) (token b) 8px)` and the
 * reserved sigils `@` and `$`. Element references are bare ids and are typed
 * by the property type (`element-ref`), not here.
 */

import { diagnostic } from '../diagnostics.js';
import { hasReservedSigil } from './scalars.js';

/**
 * @typedef {import('./types.js').TypedValue} TypedValue
 * @typedef {import('../types.js').RawValue} RawValue
 */

const PATH_REFS = { token: 'token-ref', param: 'param' };

/** Whether `raw` is a `(token ...)`, `(param ...)` or `(or ...)` link. */
export const isReference = (raw) =>
  Array.isArray(raw) && (Object.hasOwn(PATH_REFS, raw[0]) || raw[0] === 'or');

/**
 * Type a reference link.
 * @param {RawValue} raw
 * @param {(option: RawValue) => TypedValue|null} typeOption
 *   types one option of an `(or ...)` fallback, `null` when it is invalid
 * @returns {TypedValue|null|undefined} `undefined` when `raw` is not a
 *   reference, `null` when it is a malformed one (`(token)`, `(token a b)`)
 */
export function parseReference(raw, typeOption) {
  if (!isReference(raw)) {
    return undefined;
  }
  const [head, ...rest] = raw;
  if (head === 'or') {
    const options = rest.map(typeOption);
    return options.includes(null) ? null : { type: 'fallback', options };
  }
  if (rest.length !== 1 || typeof rest[0] !== 'string') {
    return null;
  }
  return { type: PATH_REFS[head], path: rest[0] };
}

/**
 * The raw form of a reference value, or `undefined` for other values.
 * @param {TypedValue} value
 * @param {(option: TypedValue) => RawValue} optionRaw
 * @returns {RawValue|undefined}
 */
export function referenceRaw(value, optionRaw) {
  switch (value.type) {
    case 'token-ref':
      return ['token', value.path];
    case 'param':
      return ['param', value.path];
    case 'fallback':
      return ['or', ...value.options.map(optionRaw)];
    default:
      return undefined;
  }
}

function eachString(raw, visit) {
  if (typeof raw === 'string') {
    visit(raw);
  } else {
    (Array.isArray(raw) ? raw : raw.values).forEach((v) =>
      eachString(v, visit)
    );
  }
}

/**
 * One `reserved-sigil` warning for every atom of `raw` that starts with `@`
 * or `$` (the parser keeps them as plain references).
 * @param {RawValue} raw
 * @param {import('../types.js').DiagnosticLocation} [at]
 * @returns {import('../types.js').Diagnostic[]}
 */
export function sigilDiagnostics(raw, at = {}) {
  const found = [];
  eachString(raw, (text) => {
    if (hasReservedSigil(text)) {
      found.push(diagnostic('reserved-sigil', 'warning', { ...at }));
    }
  });
  return found;
}
