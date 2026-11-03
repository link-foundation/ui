/**
 * Element properties by name, as React components see them. DOM-free.
 *
 * Positional values take the property names the ui-core vocabulary gives
 * them (`(greeting: text 'Hello')` has `value`), and an explicit property of
 * the same name wins, as does the last of repeated properties: the same
 * model ui-dom renders from.
 *
 * A custom kind (`(sales: chart (series 3 5 8))`) is not in the vocabulary,
 * so ui-core keeps its links in `unknown`: a link with a name head counts
 * as a property of that name, below the properties of the element.
 */

import { defaultVocabulary } from '@link-foundation/ui-core';

let vocabulary = null;

/** The positional property names of a kind. */
function positionalNames(kind) {
  vocabulary ??= defaultVocabulary();
  return vocabulary.kinds.get(kind)?.positional ?? [];
}

/** The `[name, ...values]` links of `unknown`. */
const unknownLinks = (view) =>
  (view.unknown ?? []).filter(
    (link) => Array.isArray(link) && typeof link[0] === 'string'
  );

/**
 * The values of every property of an element view, by name.
 * @param {{kind: string|null, positional?: readonly any[],
 *   properties?: readonly {name: string, values: readonly any[]}[],
 *   unknown?: readonly any[]}} view
 * @returns {Record<string, readonly any[]>}
 */
export function propsOf(view) {
  /** @type {Record<string, readonly any[]>} */
  const props = Object.create(null);
  const names = positionalNames(view.kind);
  (view.positional ?? []).slice(0, names.length).forEach((value, i) => {
    props[names[i]] = Object.freeze([value]);
  });
  for (const [name, ...values] of unknownLinks(view)) {
    props[name] = Object.freeze(values);
  }
  for (const { name, values } of view.properties ?? []) {
    props[name] = values;
  }
  return Object.freeze(props);
}

/**
 * The values of one property of an element view; `undefined` when the
 * element has no such property.
 * @param {Parameters<typeof propsOf>[0]} view
 * @param {string} name
 */
export function propOf(view, name) {
  let found;
  for (const property of view.properties ?? []) {
    if (property.name === name) {
      found = property.values;
    }
  }
  if (found !== undefined) {
    return found;
  }
  for (const [head, ...values] of unknownLinks(view)) {
    if (head === name) {
      found = values;
    }
  }
  if (found !== undefined) {
    return found;
  }
  const at = positionalNames(view.kind).indexOf(name);
  return at >= 0 && at < (view.positional?.length ?? 0)
    ? [view.positional[at]]
    : undefined;
}

/** Whether two value arrays hold the same values (one level deep). */
export function sameValues(a, b) {
  if (a === b) {
    return true;
  }
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  return a.every((value, i) => Object.is(value, b[i]));
}
