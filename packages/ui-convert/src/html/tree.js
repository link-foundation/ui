/**
 * The intermediate form shared by every HTML reader: both `importHtml`
 * (HTML text) and `importDom` (a live DOM) produce this tree, and one mapping
 * step (`import.js`) turns it into dialect elements.
 *
 * @typedef {{ start: number, end: number }} Span
 * @typedef {{
 *   tag: string,
 *   attrs: [string, string][],
 *   children: HtmlNode[],
 *   text?: string,
 *   span?: Span,
 *   node?: unknown,
 * }} HtmlNode
 *
 * `tag` is the lower-case element name, `#text` for text and `#comment` for
 * comments (which also carry `text`). `node` is the source node the reader
 * walked (a DOM `Node` or a parse5 node).
 *
 * A reader is an adapter over its own node type:
 *
 * @typedef {{
 *   type(node: any): 'element' | 'text' | 'comment' | 'container' | 'other',
 *   tag(node: any): string,
 *   attrs(node: any): [string, string][],
 *   text(node: any): string,
 *   children(node: any): any[],
 *   span(node: any): Span | undefined,
 * }} Reader
 */

export const TEXT = '#text';
export const COMMENT = '#comment';

/** Elements whose text keeps its whitespace. */
const PRESERVE = new Set(['pre', 'textarea', 'listing', 'plaintext', 'style']);

const isHtmlSpace = (c) =>
  c === ' ' || c === '\t' || c === '\n' || c === '\f' || c === '\r';

/**
 * Replace every run of HTML whitespace with one space. A character scanner,
 * no regular expressions.
 * @param {string} text
 */
export function collapseSpace(text) {
  let out = '';
  let space = false;
  for (const c of text) {
    if (isHtmlSpace(c)) {
      space = true;
    } else {
      out += space ? ` ${c}` : c;
      space = false;
    }
  }
  return space ? `${out} ` : out;
}

function trimEnds(children) {
  const first = children[0];
  if (first?.tag === TEXT) {
    first.text = first.text.trimStart();
  }
  const last = children[children.length - 1];
  if (last?.tag === TEXT) {
    last.text = last.text.trimEnd();
  }
  return children.filter((child) => child.tag !== TEXT || child.text !== '');
}

/**
 * Read one source node into the intermediate form, or `null` when it is not
 * kept (doctype, whitespace-only text, comment without `options.comments`).
 */
function readNode(reader, node, preserve, options) {
  const type = reader.type(node);
  const span = reader.span(node);
  const at = (value) => (span ? { ...value, span, node } : { ...value, node });
  if (type === 'text') {
    const raw = reader.text(node);
    const text = preserve ? raw : collapseSpace(raw);
    return text.trim() === '' && !preserve
      ? null
      : at({ tag: TEXT, attrs: [], children: [], text });
  }
  if (type === 'comment') {
    return options.comments
      ? at({ tag: COMMENT, attrs: [], children: [], text: reader.text(node) })
      : null;
  }
  if (type !== 'element') {
    return null;
  }
  const tag = reader.tag(node);
  const inner = preserve || PRESERVE.has(tag);
  return at({
    tag,
    attrs: reader.attrs(node),
    children: readChildren(reader, reader.children(node), inner, options),
  });
}

function readChildren(reader, nodes, preserve, options) {
  const children = [];
  for (const child of nodes) {
    const read = readNode(reader, child, preserve, options);
    if (read) {
      children.push(read);
    }
  }
  return preserve ? children : trimEnds(children);
}

/**
 * Read a source root into the top-level intermediate nodes. A container
 * (document or fragment) gives its children; anything else gives itself.
 * @param {Reader} reader
 * @param {any} root
 * @param {{ comments?: boolean }} options
 * @returns {HtmlNode[]}
 */
export function readTree(reader, root, options) {
  const nodes =
    reader.type(root) === 'container' ? reader.children(root) : [root];
  return readChildren(reader, nodes, false, options);
}
