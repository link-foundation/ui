/**
 * What the JSON Forms importer and exporter share.
 */

import { loadMapping } from '../mapping.js';

/** The format name used in `(source ...)`, `(extra ...)` and diagnostics. */
export const FORMAT = 'json-forms';

/** Unknown keys of data schema properties are kept under this name. */
export const SCHEMA_EXTRA = 'json-forms-schema';

/** The JSON Forms major version the mapping follows. */
export const JSON_FORMS_VERSION = '3';

/** The mapping table (mapping.lino). */
export const mapping = loadMapping(import.meta.url);

const PREFIX = '#/properties/';

/**
 * The data path of a scope made only of `properties` steps
 * (`#/properties/a/properties/b` -> `['a', 'b']`), or `null`.
 * @param {unknown} scope
 * @returns {string[]|null}
 */
export function scopePath(scope) {
  if (typeof scope !== 'string' || !scope.startsWith(PREFIX)) {
    return null;
  }
  const parts = scope.slice(PREFIX.length).split('/properties/');
  const plain = (part) =>
    part !== '' &&
    !part.includes('/') &&
    !part.includes('.') &&
    !part.includes('~') &&
    !part.includes('#');
  return parts.every(plain) ? parts : null;
}

/**
 * The `(bind ...)` value of a scope: a dotted data path when the scope has
 * only `properties` steps, otherwise the scope itself (it starts with `#`).
 * @param {string} scope
 */
export function scopeToBind(scope) {
  return scopePath(scope)?.join('.') ?? scope;
}

/**
 * The scope of a `(bind ...)` value written by {@link scopeToBind}.
 * @param {string} bind
 */
export function bindToScope(bind) {
  return bind.startsWith('#')
    ? bind
    : `${PREFIX}${bind.split('.').join('/properties/')}`;
}

/** Rule effects in LiNo, lower case. */
export const EFFECTS = ['hide', 'show', 'enable', 'disable'];
