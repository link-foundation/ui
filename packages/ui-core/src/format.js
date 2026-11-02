/**
 * `format(doc)`: UI document -> Links Notation text.
 *
 * Every link is written by `links-notation` (`Link.format`), so quoting and
 * escaping follow the parser exactly; `parse(format(doc))` gives the same
 * tree back in all three styles.
 */

import { Link, escapeReference } from 'links-notation';
import { valueLink } from './links.js';

const atoms = (texts) => texts.map((text) => new Link(text));

const propertyLink = ({ name, values }) =>
  new Link(null, [new Link(name), ...values.map(valueLink)]);

/**
 * The element head: its id, kind and positional values. An element without
 * a kind has its first value in `unknown`, so that value goes first.
 * @param {import('./types.js').UiNode} node
 */
function headValues(node) {
  return node.kind === null
    ? [valueLink(node.unknown[0]), ...atoms(node.positional)]
    : [new Link(node.kind), ...atoms(node.positional)];
}

const restUnknown = (node) =>
  node.kind === null ? node.unknown.slice(1) : node.unknown;

/**
 * The lines below the head of an element: properties and unknown sublinks
 * as links, children as nodes.
 * @param {import('./types.js').UiNode} node
 */
const body = (node) => ({
  links: [
    ...node.properties.map(propertyLink),
    ...restUnknown(node).map(valueLink),
  ],
  children: node.children,
});

/**
 * One element as a single link (the one-line form).
 * @param {import('./types.js').UiNode} node
 * @returns {Link}
 */
export function elementLink(node) {
  const { links, children } = body(node);
  return new Link(node.id, [
    ...headValues(node),
    ...links,
    ...children.map(elementLink),
  ]);
}

/**
 * A top-level raw value as a line. An atom on its own line would be read
 * back as a link, so it is written as an empty link `(name:)`.
 * @param {import('./types.js').RawValue} value
 */
const rootValueLine = (value) =>
  typeof value === 'string'
    ? `(${escapeReference(value)}:)`
    : valueLink(value).format();

/**
 * Write raw values (docs/spec/values.md) as Links Notation text, one
 * top-level link per line, with `links-notation` doing all quoting. The
 * inverse of `parseLinks`: `parseLinks(formatLinks(values))` deep-equals
 * `values` for every value that has no empty link `()` and no link with an id
 * but no values (`(name:)`, read back as the atom `name`) nested inside.
 * @param {import('./types.js').RawValue[]} values
 * @returns {string}
 */
export function formatLinks(values) {
  return values.map((value) => `${rootValueLine(value)}\n`).join('');
}

function multilineLines(node, pad, indent) {
  const head = new Link(node.id, headValues(node));
  const { links, children } = body(node);
  if (links.length === 0 && children.length === 0) {
    return [pad + head.format()];
  }
  const inner = pad + indent;
  const lines = [
    pad + head.format().slice(0, -1),
    ...links.map((link) => inner + link.format()),
    ...children.flatMap((child) => multilineLines(child, inner, indent)),
  ];
  lines[lines.length - 1] += ')';
  return lines;
}

function indentedLines(node, pad, indent) {
  if (node.kind === null) {
    return [pad + elementLink(node).format()];
  }
  const head = new Link(node.id, headValues(node));
  const { links, children } = body(node);
  const inner = pad + indent;
  return [
    pad + head.format(true),
    ...links.map((link) => inner + link.format()),
    ...children.flatMap((child) => indentedLines(child, inner, indent)),
  ];
}

const STYLES = {
  inline: (node) => [elementLink(node).format()],
  multiline: (node, indent) => multilineLines(node, '', indent),
  indented: (node, indent) => indentedLines(node, '', indent),
};

/**
 * Write a UI document as Links Notation text.
 * @param {import('./types.js').UiDocument} doc
 * @param {import('./types.js').FormatOptions} [options]
 * @returns {string}
 */
export function format(doc, options = {}) {
  const { style = 'multiline', indent = '  ' } = options;
  const write = STYLES[style];
  if (!write) {
    throw new TypeError(
      `Unknown format style "${style}"; use inline, multiline or indented`
    );
  }
  const lines = [
    ...doc.roots.flatMap((node) => write(node, indent)),
    ...doc.unknown.map(rootValueLine),
  ];
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}
