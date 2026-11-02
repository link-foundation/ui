/**
 * Reading the i18n props of an element in both parse forms: as props (with
 * `i18nVocabulary`) and as unknown sublinks (with the default vocabulary).
 */

/**
 * The values of the last `(name ...)` of a node, or `undefined`.
 * @param {import('@link-foundation/ui-core').UiNode} node
 * @param {string} name
 * @returns {import('@link-foundation/ui-core').RawValue[]|undefined}
 */
export function propValues(node, name) {
  const property = node.properties.findLast((p) => p.name === name);
  if (property !== undefined) {
    return property.values;
  }
  const link = node.unknown.findLast(
    (raw) => Array.isArray(raw) && raw[0] === name
  );
  return link === undefined ? undefined : link.slice(1);
}

/** The first value of `(name ...)` when it is an atom, else `undefined`. */
export function propAtom(node, name) {
  const [first] = propValues(node, name) ?? [];
  return typeof first === 'string' ? first : undefined;
}
