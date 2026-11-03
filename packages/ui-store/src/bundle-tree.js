/**
 * The exact form of a document in a bundle: `(document_tree ...)`.
 *
 * The LiNo text of a document (`format`) is read back through the
 * vocabulary of ui-core, so it gives the same document only when every
 * property is one the vocabulary knows. A store accepts any property name
 * (`setProp(id, 'label', ...)` on a `stack`, or a property named like a
 * kind), so `writeBundle` adds this form when the text would be read back
 * differently. Every part is tagged, so nothing depends on a vocabulary:
 *
 * ```lino
 * document_tree
 *   roots
 *     e
 *       id ok
 *       kind button
 *       pos
 *       props
 *         p label
 *           s OK
 *       children
 *       unknown
 *   unknown
 * ```
 *
 * A value is `(s word)` (a string), `(a value...)` (a link without an id) or
 * `(i id value...)` (a link with an id).
 */

import { check } from './errors.js';

/** The tag of the exact form. */
export const TREE_TAG = 'document_tree';

const toValue = (value) => {
  if (typeof value === 'string') {
    return ['s', value];
  }
  if (Array.isArray(value)) {
    return ['a', ...value.map(toValue)];
  }
  return ['i', value.id, ...value.values.map(toValue)];
};

const toElement = (node) => [
  'e',
  ...(node.id === null ? [] : [['id', node.id]]),
  ...(node.kind === null ? [] : [['kind', node.kind]]),
  ['pos', ...node.positional],
  [
    'props',
    ...node.properties.map((p) => ['p', p.name, ...p.values.map(toValue)]),
  ],
  ['children', ...node.children.map(toElement)],
  ['unknown', ...node.unknown.map(toValue)],
];

/**
 * The exact form as raw values (for `formatLinks`).
 * @param {{ roots: object[], unknown: unknown[] }} document
 */
export function treeLink(document) {
  return [
    TREE_TAG,
    ['roots', ...document.roots.map(toElement)],
    ['unknown', ...document.unknown.map(toValue)],
  ];
}

const bad = (condition, message) => check(condition, 'bad-bundle', message);
const isWord = (value) => typeof value === 'string';

/** The parts of `(tag ...)`. */
function part(value, tag) {
  bad(
    Array.isArray(value) && value[0] === tag,
    `(${TREE_TAG} ...) expects (${tag} ...), not ${JSON.stringify(value)}`
  );
  return value.slice(1);
}

function fromValue(value) {
  bad(Array.isArray(value), `A value is (s ...), (a ...) or (i ...)`);
  const [tag, ...rest] = value;
  if (tag === 's') {
    bad(rest.length === 1 && isWord(rest[0]), '(s word) holds one word');
    return rest[0];
  }
  if (tag === 'a') {
    return rest.map(fromValue);
  }
  bad(
    tag === 'i' && isWord(rest[0]),
    'A value is (s ...), (a ...) or (i id ...)'
  );
  return { id: rest[0], values: rest.slice(1).map(fromValue) };
}

function optionalWord(parts, tag) {
  if (Array.isArray(parts[0]) && parts[0][0] === tag) {
    const [word, ...extra] = part(parts.shift(), tag);
    bad(isWord(word) && extra.length === 0, `(${tag} word) holds one word`);
    return word;
  }
  return null;
}

function fromElement(value) {
  const parts = part(value, 'e');
  const id = optionalWord(parts, 'id');
  const kind = optionalWord(parts, 'kind');
  bad(
    parts.length === 4,
    'An element is (e (id)? (kind)? pos props children unknown)'
  );
  const positional = part(parts[0], 'pos');
  bad(positional.every(isWord), '(pos ...) holds words');
  return {
    id,
    kind,
    positional,
    properties: part(parts[1], 'props').map((property) => {
      const [name, ...values] = part(property, 'p');
      bad(isWord(name), 'A property is (p name value...)');
      return { name, values: values.map(fromValue) };
    }),
    children: part(parts[2], 'children').map(fromElement),
    unknown: part(parts[3], 'unknown').map(fromValue),
  };
}

/**
 * Read the parts of `(document_tree ...)` (raw values from `parseLinks`).
 * @param {unknown[]} parts
 * @returns {{ roots: object[], unknown: unknown[] }}
 */
export function readTree(parts) {
  bad(parts.length === 2, `(${TREE_TAG} (roots ...) (unknown ...))`);
  return {
    roots: part(parts[0], 'roots').map(fromElement),
    unknown: part(parts[1], 'unknown').map(fromValue),
  };
}
