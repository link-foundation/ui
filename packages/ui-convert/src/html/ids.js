/**
 * Link ids of imported elements. The same input always gives the same ids:
 *
 * - an element's `id` attribute is used when it is a valid Links Notation
 *   reference (written without quotes) and the first one with that value;
 * - every other node gets a path id from its tag and the indices from the
 *   root (`div-0-2-1`: the second child of the third child of the first
 *   top-level node);
 * - an id that is already taken gets the first free suffix `-2`, `-3`, ...
 */

import { escapeReference } from 'links-notation';
import { COMMENT, TEXT } from './tree.js';

/**
 * Whether `value` can be a link id as it is: a non-empty reference that
 * needs no quotes and does not start with a reserved sigil (`@`, `$`).
 * @param {string | undefined} value
 */
export const isValidId = (value) =>
  typeof value === 'string' &&
  value !== '' &&
  escapeReference(value) === value &&
  !value.startsWith('@') &&
  !value.startsWith('$');

/** The value of attribute `name`, or `undefined`. */
export const attrValue = (node, name) =>
  node.attrs.find(([key]) => key === name)?.[1];

const ID_TAGS = { [TEXT]: 'text', [COMMENT]: 'comment' };

/** The tag part of a path id. */
function idTag(node) {
  const tag = ID_TAGS[node.tag] ?? node.tag;
  return isValidId(tag) ? tag : 'element';
}

function walk(nodes, path, visit) {
  nodes.forEach((node, index) => {
    const here = [...path, index];
    visit(node, here);
    walk(node.children, here, visit);
  });
}

/**
 * Assign a unique link id to every node of the intermediate tree, in
 * document order.
 * @param {import('./tree.js').HtmlNode[]} roots
 * @returns {Map<import('./tree.js').HtmlNode, string>}
 */
export function assignIds(roots) {
  const taken = new Set();
  walk(roots, [], (node) => {
    const id = attrValue(node, 'id');
    if (isValidId(id)) {
      taken.add(id);
    }
  });
  const used = new Set();
  const ids = new Map();
  walk(roots, [], (node, path) => {
    const own = attrValue(node, 'id');
    if (isValidId(own) && !used.has(own)) {
      used.add(own);
      ids.set(node, own);
      return;
    }
    const base = isValidId(own) ? own : `${idTag(node)}-${path.join('-')}`;
    let id = base;
    for (let n = 2; taken.has(id); n++) {
      id = `${base}-${n}`;
    }
    taken.add(id);
    used.add(id);
    ids.set(node, id);
  });
  return ids;
}
