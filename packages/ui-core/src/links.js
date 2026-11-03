/**
 * Small helpers over `links-notation` `Link` objects. Every structural
 * decision of the projection is made on `Link` objects returned by the
 * official parser; only `parseNested` reads Links Notation text, with the official parser.
 */

import { Link, Parser } from 'links-notation';

/**
 * An atom (a reference) is a link without values; its text is its id.
 * @param {Link} link
 * @returns {boolean}
 */
export const isAtom = (link) => link.values.length === 0;

/**
 * A path link has no id and its first value is itself a link, e.g.
 * `((ok: button) (label OK))` (see docs/spec/projection.md).
 * @param {Link} link
 * @returns {boolean}
 */
export const isPathLink = (link) =>
  link.id === null && link.values.length > 0 && !isAtom(link.values[0]);

/**
 * The head (first value) of a non-atom link as text, or `null` when the first
 * value is not an atom.
 * @param {Link} link
 * @returns {string|null}
 */
export function headText(link) {
  if (isAtom(link)) {
    return link.id;
  }
  const [first] = link.values;
  return isAtom(first) ? first.id : null;
}

function keyTree(link) {
  return isAtom(link) ? link.id : [link.id, ...link.values.map(keyTree)];
}

/**
 * A string key that is equal for two links exactly when `Link.equals`
 * considers them structurally equal (same ids, same values in the same
 * order, recursively), so links can be used as `Map` keys.
 * @param {Link} link
 * @returns {string}
 */
export const linkKey = (link) => JSON.stringify(keyTree(link));

/**
 * JSON form of a value (docs/spec/values.md): an atom is a string, a link
 * without an id is an array, a link with an id is `{ id, values }`.
 * @param {Link} link
 * @returns {import('./types.js').RawValue}
 */
export function valueJson(link) {
  if (isAtom(link)) {
    return link.id;
  }
  const values = link.values.map(valueJson);
  return link.id === null ? values : { id: link.id, values };
}

/**
 * Inverse of {@link valueJson}: build a `Link` from a JSON value.
 * @param {import('./types.js').RawValue} value
 * @returns {Link}
 */
export function valueLink(value) {
  if (typeof value === 'string') {
    return new Link(value);
  }
  if (Array.isArray(value)) {
    return new Link(null, value.map(valueLink));
  }
  return new Link(value.id, value.values.map(valueLink));
}

/**
 * A group of `Parser.parseGroups()` as one link: the indented lines are
 * appended to the values of the line they are indented under.
 * @param {import('links-notation').LinksGroup} group
 * @returns {Link}
 */
export function unindent(group) {
  const { element, children } = group;
  return children.length > 0
    ? new Link(element.id, [...element.values, ...children.map(unindent)])
    : element;
}

/**
 * Read Links Notation text into the `Link` objects of `links-notation`, with
 * the lines indented under a line as values of the link of that line: the
 * nested form (#133) reads back as the links it was written from, and the
 * one-line and parenthesized forms read as with `Parser.parse()`. For the
 * readers of LiNo formats other than UI documents (rules, mapping tables,
 * charts). Throws the errors of the parser.
 * @param {string} text
 * @param {{ maxDepth?: number, maxInputSize?: number }} [options] the options of `Parser`
 * @returns {Link[]}
 */
export function parseNested(text, options = {}) {
  return new Parser(options).parseGroups(text).map(unindent);
}
