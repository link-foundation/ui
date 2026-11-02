/**
 * The element model the kinds see: a store element view plus `props`, every
 * property by name. Positional values take the property names the
 * vocabulary gives them (`(greeting: text 'Hello')` has `value`), and an
 * explicit property of the same name wins, as does the last of repeated
 * properties.
 */

import { defaultVocabulary } from '@link-foundation/ui-core';

const VOCABULARY = defaultVocabulary();

/** The ui-core vocabulary the renderer checks actions against. */
export const vocabulary = () => VOCABULARY;

/**
 * @typedef {import('@link-foundation/ui-core').RawValue} RawValue
 * @typedef {import('@link-foundation/ui-core').UiProperty} UiProperty
 *
 * @typedef {object} Element
 * @property {string} id  the store ID (`data-link-id`)
 * @property {string|null} name  the id in the document
 * @property {string|null} kind
 * @property {readonly RawValue[]} positional
 * @property {readonly UiProperty[]} properties
 * @property {readonly RawValue[]} unknown
 * @property {ReadonlyMap<string, readonly RawValue[]>} props
 */

/**
 * The element model of a store element view (or a ui-core node with `id`).
 * @param {{id: string, name?: string|null, kind: string|null,
 *   positional?: readonly RawValue[], properties?: readonly UiProperty[],
 *   unknown?: readonly RawValue[]}} view
 * @returns {Element}
 */
export function elementOf(view) {
  const positional = view.positional ?? [];
  const properties = view.properties ?? [];
  const names = VOCABULARY.kinds.get(view.kind)?.positional ?? [];
  const props = new Map();
  positional.forEach((value, i) => {
    if (i < names.length) {
      props.set(names[i], [value]);
    }
  });
  for (const property of properties) {
    props.set(property.name, property.values);
  }
  return Object.freeze({
    id: view.id,
    name: view.name ?? null,
    kind: view.kind ?? null,
    positional,
    properties,
    unknown: view.unknown ?? [],
    props,
  });
}

/**
 * The same element with other properties (a store `update` event).
 * @param {Element} element
 * @param {readonly UiProperty[]} properties
 */
export const withProperties = (element, properties) =>
  elementOf({ ...element, properties });

/**
 * The single text value of a property; `undefined` when it is missing or
 * is not one plain value.
 * @param {Element} element
 * @param {string} name
 * @returns {string|undefined}
 */
export function atom(element, name) {
  const values = element.props.get(name);
  return values?.length === 1 && typeof values[0] === 'string'
    ? values[0]
    : undefined;
}

/** Every property name of the element (the first `update` of a node). */
export const propNames = (element) => [...element.props.keys()];
