/**
 * Helpers for Links Notation values (atoms, links, `{ id, values }`).
 */

import { formatLinks } from '@link-foundation/ui-core';

/** @typedef {import('@link-foundation/ui-core').RawValue} RawValue */

/**
 * Whether two values (or lists of values) are equal.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function valuesEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => valuesEqual(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return (
      /** @type {any} */ (a).id === /** @type {any} */ (b).id &&
      valuesEqual(/** @type {any} */ (a).values, /** @type {any} */ (b).values)
    );
  }
  return false;
}

/**
 * Whether `value` is a Links Notation value.
 * @param {unknown} value
 * @returns {value is RawValue}
 */
export function isValue(value) {
  if (typeof value === 'string') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isValue);
  }
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (/** @type {any} */ (value).id) === 'string' &&
    Array.isArray(/** @type {any} */ (value).values) &&
    /** @type {any} */ (value).values.every(isValue)
  );
}

/**
 * A deep frozen copy of a list of values.
 * @param {readonly RawValue[]} values
 * @returns {readonly RawValue[]}
 */
export function freezeValues(values) {
  const copy = (v) =>
    typeof v === 'string'
      ? v
      : Array.isArray(v)
        ? Object.freeze(v.map(copy))
        : Object.freeze({
            id: v.id,
            values: Object.freeze(v.values.map(copy)),
          });
  return Object.freeze(values.map(copy));
}

/**
 * A mutable deep copy of a list of values.
 * @param {readonly RawValue[]} values
 * @returns {RawValue[]}
 */
export function copyValues(values) {
  const copy = (v) =>
    typeof v === 'string'
      ? v
      : Array.isArray(v)
        ? v.map(copy)
        : { id: v.id, values: v.values.map(copy) };
  return values.map(copy);
}

/**
 * A list of values as Links Notation, without the outer parentheses:
 * `['Hello, links']` → `'Hello, links'`.
 * @param {readonly RawValue[]} values
 */
export function describeValues(values) {
  if (values.length === 0) {
    return '()';
  }
  const text = formatLinks([/** @type {RawValue[]} */ ([...values])]).trim();
  return text.startsWith('(') && text.endsWith(')') ? text.slice(1, -1) : text;
}

/** The index of the last property `name` (with the first value `key`). */
export function findProperty(properties, name, key) {
  for (let i = properties.length - 1; i >= 0; i--) {
    const p = properties[i];
    if (p.name === name && (key === null || p.values[0] === key)) {
      return i;
    }
  }
  return -1;
}

/**
 * The value a target has in an element (a node or a store view).
 * @param {{ positional: readonly RawValue[], properties: readonly { name: string, values: readonly RawValue[] }[] }} node
 * @param {{ name: string, key: string|null, mode: 'positional'|'keyed'|'prop' }} t
 * @returns {readonly RawValue[]|undefined}
 */
export function valueIn(node, t) {
  if (t.mode === 'positional') {
    return node.positional.length > 0 ? node.positional : undefined;
  }
  const at = findProperty(node.properties, t.name, t.key);
  if (at < 0) {
    return undefined;
  }
  const { values } = node.properties[at];
  return t.mode === 'keyed' ? values.slice(1) : values;
}
