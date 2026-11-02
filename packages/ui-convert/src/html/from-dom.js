/**
 * Live DOM -> intermediate form (browsers and jsdom). Only standard `Node`
 * properties are used, so any DOM implementation works.
 */

import { readTree } from './tree.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const COMMENT_NODE = 8;
const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;

const TYPES = {
  [ELEMENT_NODE]: 'element',
  [TEXT_NODE]: 'text',
  [CDATA_SECTION_NODE]: 'text',
  [COMMENT_NODE]: 'comment',
  [DOCUMENT_NODE]: 'container',
  [DOCUMENT_FRAGMENT_NODE]: 'container',
};

/**
 * @param {((node: any) => any) | undefined} location optional source
 *   location of a node: `{ startOffset, endOffset }` (jsdom's
 *   `dom.nodeLocation`) or `{ start, end }`
 * @returns {import('./tree.js').Reader}
 */
const domReader = (location) => ({
  type: (node) => TYPES[node.nodeType] ?? 'other',
  tag: (node) => node.localName,
  attrs: (node) =>
    Array.from(node.attributes, (attr) => [attr.name, attr.value]),
  text: (node) => node.data,
  children: (node) =>
    Array.from(
      node.localName === 'template' && node.content
        ? node.content.childNodes
        : node.childNodes
    ),
  span(node) {
    const found = location?.(node);
    if (!found) {
      return undefined;
    }
    return 'startOffset' in found
      ? { start: found.startOffset, end: found.endOffset }
      : { start: found.start, end: found.end };
  },
});

/**
 * Read a DOM subtree into the intermediate form. A document or fragment
 * gives its children; an element or text node gives itself.
 * @param {any} root
 * @param {{ comments?: boolean, location?: (node: any) => any }} options
 * @returns {import('./tree.js').HtmlNode[]}
 */
export function readDom(root, options) {
  return readTree(domReader(options.location), root, options);
}
