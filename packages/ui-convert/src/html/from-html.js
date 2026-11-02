/**
 * HTML text -> intermediate form. The text is read by `parse5`, the
 * WHATWG-compliant HTML parser that jsdom also uses, so `importHtml` and
 * `importDom` see the same tree; its source locations become the spans.
 *
 * The planned reader is the `meta-language` HTML import, but its npm
 * release (0.46.0) has no element tree yet, see
 * https://github.com/link-foundation/meta-language/issues/230. A reader
 * built on it only has to return the same intermediate form.
 */

import { parse, parseFragment } from 'parse5';
import { readTree } from './tree.js';

/** @type {import('./tree.js').Reader} */
const parse5Reader = {
  type(node) {
    switch (node.nodeName) {
      case '#text':
        return 'text';
      case '#comment':
        return 'comment';
      case '#document':
      case '#document-fragment':
        return 'container';
      case '#documentType':
        return 'other';
      default:
        return 'element';
    }
  },
  tag: (node) => node.tagName,
  attrs: (node) =>
    node.attrs.map(({ name, prefix, value }) => [
      prefix ? `${prefix}:${name}` : name,
      value,
    ]),
  text: (node) => (node.nodeName === '#text' ? node.value : node.data),
  children: (node) => (node.content ?? node).childNodes ?? [],
  span(node) {
    const location = node.sourceCodeLocation;
    return location
      ? { start: location.startOffset, end: location.endOffset }
      : undefined;
  },
};

/**
 * Read HTML text into the intermediate form.
 * @param {string} text
 * @param {{ document?: boolean, comments?: boolean }} options
 * @returns {import('./tree.js').HtmlNode[]}
 */
export function readHtml(text, options) {
  const read = options.document ? parse : parseFragment;
  const root = read(text, { sourceCodeLocationInfo: true });
  return readTree(parse5Reader, root, options);
}
