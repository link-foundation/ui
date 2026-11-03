/**
 * Readers of property links shared by the chart dialect and the small
 * charts: `(name value)` atoms, numbers, booleans, and property lists.
 */

import { fail } from './errors.js';
import { headName, isAtom } from './lino.js';
import { toNumber } from './values.js';

/** The single atom value of a property node, or a ChartSpecError. */
export function single(node, path, name) {
  const [, ...values] = node.values;
  if (values.length !== 1 || !isAtom(values[0])) {
    fail('invalid-value', `(${name}) needs exactly one value`, node, path);
  }
  return values[0].id;
}

/** A finite number property. */
export function numberOf(node, path, name) {
  const value = toNumber(single(node, path, name));
  if (value === null) {
    fail('invalid-value', `(${name}) must be a number`, node, path);
  }
  return value;
}

/** A `true`/`false` property. */
export function booleanOf(node, path, name) {
  const value = single(node, path, name);
  if (value !== 'true' && value !== 'false') {
    fail('invalid-value', `(${name}) must be true or false`, node, path);
  }
  return value === 'true';
}

/**
 * The property nodes of a link after its kind (or name), each with its
 * position, checked against the allowed names and for repeats.
 * @param {import('./lino.js').Node} node
 * @param {number[]} path
 * @param {number} from  the index of the first property
 * @param {readonly string[]} allowed
 * @param {readonly string[]} [repeatable]
 * @returns {Map<string, {node: import('./lino.js').Node, path: number[]}[]>}
 */
export function properties(node, path, from, allowed, repeatable = []) {
  const found = new Map();
  node.values.slice(from).forEach((child, i) => {
    const where = [...path, from + i];
    const name = headName(child);
    if (name === null || !allowed.includes(name)) {
      fail(
        'unknown-property',
        name === null
          ? 'expected a property link (name value...)'
          : `unknown property "${name}"`,
        child,
        where
      );
    }
    if (found.has(name) && !repeatable.includes(name)) {
      fail('duplicate-property', `(${name}) is given twice`, child, where);
    }
    found.set(name, [...(found.get(name) ?? []), { node: child, path: where }]);
  });
  return found;
}

/** The text of an optional single-atom property. */
export function optionalText(props, name) {
  const entry = props.get(name)?.[0];
  return entry === undefined ? null : single(entry.node, entry.path, name);
}

/** The numbers of a list property `(name 1 2 3)` (at least one). */
export function numberList(entry, name) {
  const { node, path } = entry;
  const values = node.values.slice(1);
  if (values.length === 0) {
    fail('invalid-value', `(${name}) needs at least one number`, node, path);
  }
  return values.map((value, i) => {
    const number = isAtom(value) ? toNumber(value.id) : null;
    if (number === null) {
      fail('invalid-value', `(${name}) must hold numbers`, value, [
        ...path,
        i + 1,
      ]);
    }
    return number;
  });
}

/** An optional number property, or `fallback`. */
export function optionalNumber(props, name, fallback = null) {
  const entry = props.get(name)?.[0];
  return entry === undefined
    ? fallback
    : numberOf(entry.node, entry.path, name);
}
