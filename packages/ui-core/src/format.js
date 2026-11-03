/**
 * `format(doc)`: UI document -> Links Notation text.
 *
 * The default style is `indented`: the nested form of Links Notation, where
 * every link value that can go on its own indented line does, so documents
 * need as few parentheses as possible (#133). Every reference is quoted by
 * `links-notation` (`escapeReference`, `Link.format`), so quoting and
 * escaping follow the parser exactly; `parse(format(doc))` gives the same
 * tree back in all three styles.
 */

import { Link, escapeReference } from 'links-notation';
import { isAtom, valueLink } from './links.js';

/* ------------------------------------------------------------------ */
/* The nested (indented) form of any link.                              */
/* ------------------------------------------------------------------ */

/**
 * A value of a link as written inside a line: a quoted reference or a whole
 * link in parentheses.
 * @param {Link} value
 */
const inlineValue = (value) =>
  isAtom(value) ? escapeReference(value.id) : value.format();

/**
 * Whether a value can be written as an indented line of its own. An atom
 * cannot (a lone reference on a line is read as a one-value link), and
 * neither can a link without an id whose only value is a link: the parser
 * unwraps a line that is a single parenthesized link.
 * @param {Link} value
 */
const canNest = (value) =>
  !isAtom(value) &&
  !(value.id === null && value.values.length === 1 && !isAtom(value.values[0]));

/**
 * Whether `values.slice(0, count)` may be the text of a line of a link with
 * this id. A line with an id may hold no values (`name:`); a line without an
 * id needs two values, or one reference (one parenthesized link would be
 * unwrapped).
 */
function lineHolds(id, values, count) {
  if (id !== null) {
    return true;
  }
  return count >= 2 || (count === 1 && isAtom(values[0]));
}

/**
 * How many leading values of a link stay on its line; the rest become the
 * indented lines below it. Only a trailing run of values that can nest is
 * moved, so the order of the values never changes.
 * @param {Link} link
 */
function lineValueCount(link) {
  const { id, values } = link;
  let count = values.length;
  while (count > 0 && canNest(values[count - 1])) {
    count -= 1;
  }
  while (count < values.length && !lineHolds(id, values, count)) {
    count += 1;
  }
  return count;
}

/**
 * The lines of a link in the nested form, the inverse of reading text with
 * `Parser.parseGroups()` and appending the indented lines of a group to the
 * values of its line.
 * @param {Link} link a link with values
 * @param {string} pad the indentation of its first line
 * @param {string} indent one level of indentation
 * @param {boolean} underName whether the line above is a bare `name:`
 * @returns {string[]}
 */
function nestedLines(link, pad, indent, underName = false) {
  const { id, values } = link;
  if (!lineHolds(id, values, values.length)) {
    // `()`, `((a b))`: no line form without parentheses.
    return [pad + link.format()];
  }
  if (underName && id === null && values.length === 1) {
    // `parse()` reads `name:` + a lone reference line as a value of `name`,
    // not as a one-value link; parentheses keep both readings the same.
    return [pad + link.format()];
  }
  const count = lineValueCount(link);
  const inline = values.slice(0, count).map(inlineValue);
  const text =
    id === null
      ? inline.join(' ')
      : [`${escapeReference(id)}:`, ...inline].join(' ');
  const inner = pad + indent;
  const bare = id !== null && count === 0;
  return [
    pad + text,
    ...values
      .slice(count)
      .flatMap((value) => nestedLines(value, inner, indent, bare)),
  ];
}

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
 * A top-level link as lines. An atom on its own line would be read back as
 * a link, so it is written as an empty link `(name:)`.
 * @param {Link} link
 * @param {'inline'|'multiline'|'indented'} style
 * @param {string} indent
 * @returns {string[]}
 */
function rootLinkLines(link, style, indent) {
  if (isAtom(link)) {
    return [`(${escapeReference(link.id)}:)`];
  }
  return style === 'indented' ? nestedLines(link, '', indent) : [link.format()];
}

const rootValueLines = (value, style, indent) =>
  rootLinkLines(
    value instanceof Link ? value : valueLink(value),
    style,
    indent
  );

/**
 * Check a `style` option.
 * @param {string} style
 */
function checkStyle(style) {
  if (!Object.hasOwn(STYLES, style)) {
    throw new TypeError(
      `Unknown format style "${style}"; use indented, multiline or inline`
    );
  }
}

/**
 * Write raw values (docs/spec/values.md) or `links-notation` `Link`s as
 * Links Notation text, with `links-notation` doing all quoting. By default each top-level value is
 * written in the nested `indented` form (#133); `style: 'inline'` (or
 * `'multiline'`, the same for raw values) writes one top-level link per
 * line. The inverse of `parseLinks`: `parseLinks(formatLinks(values))`
 * deep-equals `values` for every value that has no empty link `()` and no
 * link with an id but no values (`(name:)`, read back as the atom `name`)
 * nested inside.
 * @param {(import('./types.js').RawValue | Link)[]} values
 * @param {import('./types.js').FormatOptions} [options]
 * @returns {string}
 */
export function formatLinks(values, options = {}) {
  const { style = 'indented', indent = '  ' } = options;
  checkStyle(style);
  return values
    .flatMap((value) => rootValueLines(value, style, indent))
    .map((line) => `${line}\n`)
    .join('');
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

const STYLES = {
  inline: (node) => [elementLink(node).format()],
  multiline: (node, indent) => multilineLines(node, '', indent),
  indented: (node, indent) =>
    rootLinkLines(elementLink(node), 'indented', indent),
};

/**
 * Write a UI document as Links Notation text. The default `indented` style
 * is the nested form with as few parentheses as possible:
 *
 * ```lino
 * ok: button
 *   label OK
 *   on press
 *     navigate home
 * ```
 *
 * `multiline` (one parenthesized link per element, its sublinks indented
 * inside) and `inline` (one line per root element) are the other styles.
 * @param {import('./types.js').UiDocument} doc
 * @param {import('./types.js').FormatOptions} [options]
 * @returns {string}
 */
export function format(doc, options = {}) {
  const { style = 'indented', indent = '  ' } = options;
  checkStyle(style);
  const write = STYLES[style];
  const unknownStyle = style === 'indented' ? 'indented' : 'inline';
  const lines = [
    ...doc.roots.flatMap((node) => write(node, indent)),
    ...doc.unknown.flatMap((value) =>
      rootValueLines(value, unknownStyle, indent)
    ),
  ];
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}
