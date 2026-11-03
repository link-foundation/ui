/**
 * Links Notation helpers of the chart dialect.
 *
 * Text is read only by the official `links-notation` parser. It returns a
 * link written over several lines as path links: the multi-line form
 * `(H\n  a\n  b)` gives `(H (H a) (H b))`, and the indented form gives `H`,
 * `(H a)`, `(H b)` as separate top-level links. `unfoldLinks` turns every
 * form back into the nested tree the author wrote, as ui-core path folding
 * does for UI documents (docs/spec/projection.md), so the one-line,
 * multi-line and indented forms of a chart give the same spec.
 *
 * Text is written only through links-notation `escapeReference` (atoms) and
 * `Link#format` (one-line links); this module only indents the lines.
 */

import { parseNested } from '@link-foundation/ui-core';
import { Link, escapeReference } from 'links-notation';

/**
 * A link as the chart reader sees it: an atom has no values.
 * @typedef {{ id: string|null, values: Node[] }} Node
 */

/** Whether two links (or nodes) are the same tree. */
export function sameLink(a, b) {
  if (a.id !== b.id || a.values.length !== b.values.length) {
    return false;
  }
  return a.values.every((value, i) => sameLink(value, b.values[i]));
}

/** A head of a multi-line or indented group: a link with values. */
const isHead = (link) => link.values.length > 0;

/**
 * Whether `link` is a multi-line group `(H (H a) (H b) ...)`: no id, a head
 * `H` that is a link (not an atom), and every other value `(H x)`.
 */
function isGroup(link) {
  if (link.id !== null || link.values.length < 2 || !isHead(link.values[0])) {
    return false;
  }
  const [head, ...rest] = link.values;
  return rest.every(
    (value) =>
      value.id === null &&
      value.values.length === 2 &&
      sameLink(value.values[0], head)
  );
}

/**
 * The nested tree of one link: multi-line groups are folded into their head.
 * @param {Link|Node} link
 * @returns {Node}
 */
export function unfoldLink(link) {
  const values = link.values ?? [];
  if (isGroup(link)) {
    const head = unfoldLink(values[0]);
    return {
      id: head.id,
      values: [...head.values, ...values.slice(1).map((v) => unfold(v))],
    };
  }
  return { id: link.id ?? null, values: values.map(unfoldLink) };
}

/** The payload of a group member `(H x)`. */
const unfold = (member) => unfoldLink(member.values[1]);

/**
 * The nested trees of the top-level links. An indented child `(H x)` whose
 * head `H` is an earlier top-level link is appended to that link.
 * @param {readonly (Link|Node)[]} links
 * @returns {Node[]}
 */
export function unfoldLinks(links) {
  const roots = [];
  const heads = [];
  for (const link of links) {
    const values = link.values ?? [];
    const owner =
      link.id === null && values.length === 2
        ? heads.find(({ source }) => sameLink(source, values[0]))
        : undefined;
    if (owner !== undefined) {
      owner.node.values.push(unfoldLink(values[1]));
      continue;
    }
    const node = unfoldLink(link);
    roots.push(node);
    if (isHead(link)) {
      heads.push({ source: link, node });
    }
  }
  return roots;
}

/**
 * Parse LiNo text with the official parser; indented lines are values of
 * the line above them (the nested form).
 * @param {string} text
 * @returns {Link[]}
 */
export const parseLino = (text) => parseNested(text);

/** Whether a node is an atom (a reference without values). */
export const isAtom = (node) => node.values.length === 0 && node.id !== null;

/** The name of a property link `(name ...)`, or `null`. */
export function headName(node) {
  if (node.id !== null || node.values.length === 0) {
    return null;
  }
  return isAtom(node.values[0]) ? node.values[0].id : null;
}

/** A plain node of an atom. */
export const atomNode = (text) => ({ id: String(text), values: [] });

/** A property node `(name value...)`; values are nodes or atom texts. */
export const prop = (name, ...values) => ({
  id: null,
  values: [
    atomNode(name),
    ...values.map((v) => (typeof v === 'object' ? v : atomNode(v))),
  ],
});

/** The links-notation `Link` of a node. */
export const toLink = (node) =>
  isAtom(node)
    ? new Link(node.id)
    : new Link(
        node.id,
        node.values.map((v) => toLink(v))
      );

/** One-line LiNo text of a node (links-notation `Link#format`). */
export function formatNode(node) {
  if (isAtom(node)) {
    return escapeReference(node.id);
  }
  return toLink(node).format();
}

const MAX_LINE = 80;

/**
 * LiNo text of a node: one line when it fits, otherwise the head on the
 * first line and one child per indented line (the multi-line form).
 * @param {Node} node
 * @param {string} [indent]
 * @returns {string}
 */
export function formatPretty(node, indent = '') {
  const line = formatNode(node);
  if (
    isAtom(node) ||
    indent.length + line.length <= MAX_LINE ||
    node.values.every(isAtom)
  ) {
    return line;
  }
  const lead = [];
  let i = 0;
  while (i < node.values.length && isAtom(node.values[i])) {
    lead.push(escapeReference(node.values[i].id));
    i += 1;
  }
  const id = node.id === null ? '' : `${escapeReference(node.id)}: `;
  const inner = `${indent}  `;
  const children = node.values
    .slice(i)
    .map((child) => `\n${inner}${formatPretty(child, inner)}`);
  return `(${id}${lead.join(' ')}${children.join('')})`;
}
