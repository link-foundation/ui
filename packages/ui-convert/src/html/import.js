/**
 * HTML / DOM -> UI dialect of Links Notation.
 *
 * Both entry points read their input into the intermediate form
 * (`tree.js`), give every node a deterministic id (`ids.js`) and run the
 * same mapping step (`mapping.js`) that builds `Link` objects of
 * `links-notation`. The links are projected and formatted by
 * `@link-foundation/ui-core`, whose `format` writes every link with
 * `Link.format`; no Links Notation text is concatenated here.
 */

import { Link } from 'links-notation';
import {
  SPEC_VERSION,
  format,
  projectLinks,
  valueMatches,
} from '@link-foundation/ui-core';
import { readHtml } from './from-html.js';
import { readDom } from './from-dom.js';
import { assignIds } from './ids.js';
import { HTML_FALLBACK_KIND, HTML_MAPPING, findRule } from './mapping.js';
import { DROPPED_TAGS, droppedScript, unsafeAttribute } from './security.js';
import { collapseCss, parseStyle, styleLink } from './style.js';
import { COMMENT, TEXT } from './tree.js';
import { htmlVocabulary } from './vocabulary.js';

const atom = (text) => new Link(text);
const property = (name, ...values) =>
  new Link(null, [atom(name), ...values.map(atom)]);

const textOf = (node) =>
  node.children
    .filter((child) => child.tag === TEXT)
    .map((child) => child.text)
    .join('');

/** A `<style>` child without attributes becomes `(raw-css ...)`. */
const isPlainStyle = (node) => node.tag === 'style' && node.attrs.length === 0;

/** The text content when every child is text, otherwise `null`. */
const textContent = (children) =>
  children.every((child) => child.tag === TEXT)
    ? children
        .map((child) => child.text)
        .join('')
        .trim()
    : null;

class Importer {
  constructor(roots, options) {
    this.vocabulary = options.vocabulary ?? htmlVocabulary();
    this.table = options.mapping ?? HTML_MAPPING;
    this.ids = assignIds(roots);
    /** Document order of every node, to report diagnostics in that order. */
    this.order = new Map([...this.ids.keys()].map((node, i) => [node, i]));
    this.keepNodes = Boolean(options.keepNodes);
    this.diagnostics = [];
    this.spans = new Map();
    this.nodeMap = new Map();
  }

  /** Remove dropped elements, with one diagnostic each. */
  safe(nodes) {
    return nodes.filter((node) => {
      if (!DROPPED_TAGS.includes(node.tag)) {
        return true;
      }
      this.report(node, `the <${node.tag}> element`);
      return false;
    });
  }

  report(node, what) {
    this.diagnostics.push({
      order: this.order.get(node),
      diagnostic: droppedScript(this.ids.get(node), what),
    });
  }

  /** The attributes that stay, without the id the link already carries. */
  safeAttrs(node, id) {
    return node.attrs.filter(([name, value]) => {
      const unsafe = unsafeAttribute(name, value);
      if (unsafe) {
        this.report(node, unsafe);
        return false;
      }
      return !(name === 'id' && value === id);
    });
  }

  remember(node, id) {
    if (node.span) {
      this.spans.set(id, node.span);
    }
    if (this.keepNodes && node.node !== undefined) {
      this.nodeMap.set(id, node.node);
    }
  }

  /**
   * One node of the intermediate form as an element link.
   * @param {import('./tree.js').HtmlNode} node
   * @returns {Link}
   */
  link(node) {
    const id = this.ids.get(node);
    this.remember(node, id);
    if (node.tag === TEXT || node.tag === COMMENT) {
      const kind = node.tag === TEXT ? 'text' : 'comment';
      return new Link(id, [atom(kind), atom(node.text)]);
    }
    const attrs = this.safeAttrs(node, id);
    const inner = this.safe(node.children);
    const styles = node.tag === 'style' ? [node] : inner.filter(isPlainStyle);
    const children =
      node.tag === 'style' ? [] : inner.filter((c) => !isPlainStyle(c));
    const mapped = this.mapped(node, children, attrs) ?? {
      head: [atom(HTML_FALLBACK_KIND), property('tag', node.tag)],
      attrs,
      children,
    };
    return new Link(id, [
      ...mapped.head,
      ...mapped.attrs.flatMap(([name, value]) =>
        name === 'style'
          ? []
          : [
              value === ''
                ? property('attr', name)
                : property('attr', name, value),
            ]
      ),
      ...[styleLink(parseStyle(attrValue(attrs, 'style') ?? ''))].filter(
        Boolean
      ),
      ...styles
        .map((style) => collapseCss(textOf(style)))
        .filter((css) => css !== '')
        .map((css) => property('raw-css', css)),
      ...mapped.children.map((child) => this.link(child)),
    ]);
  }

  /**
   * The head, remaining attributes and children of an element that a rule
   * of the mapping table maps to a dialect kind, or `null` (fallback).
   */
  mapped(node, children, attrs) {
    const rule = findRule(node, this.vocabulary, this.table);
    if (!rule) {
      return null;
    }
    const spec = this.vocabulary.kinds.get(rule.kind);
    const text = rule.text ? textContent(children) : null;
    if (spec.children === 'none' && children.length > 0 && text === null) {
      return null;
    }
    const { head, consumed } = ruleHead(rule, spec, node, text, attrs);
    return {
      head,
      attrs: attrs.filter(([name]) => !consumed.has(name)),
      children: text === null ? children : [],
    };
  }

  /** Convert the top-level nodes and format the result. */
  run(roots, options) {
    const links = this.safe(roots).map((node) => this.link(node));
    const projected = projectLinks(links, this.vocabulary);
    const tree = { spec: SPEC_VERSION, ...projected };
    const text = format(tree, {
      style: options.style ?? 'multiline',
      indent: options.indent,
    });
    const result = {
      text,
      tree,
      links,
      spans: this.spans,
      diagnostics: [
        ...this.diagnostics
          .sort((a, b) => a.order - b.order)
          .map((entry) => entry.diagnostic),
        ...projected.diagnostics,
      ],
    };
    if (this.keepNodes) {
      result.nodeMap = this.nodeMap;
    }
    return result;
  }
}

/**
 * The head of a mapped element: kind, text, the attributes the rule turns
 * into properties (when their value matches the property type), `tag` when
 * the element is not the tag the kind stands for, and the heading `level`.
 */
function ruleHead(rule, spec, node, text, attrs) {
  const head = [atom(rule.kind)];
  if (text && rule.text === 'positional') {
    head.push(atom(text));
  } else if (text) {
    head.push(property(rule.text, text));
  }
  const consumed = new Set();
  for (const [name, target] of Object.entries(rule.attrs ?? {})) {
    const value = attrValue(attrs, name);
    const type = spec.properties.get(target)?.type;
    if (value && type && valueMatches(type, value)) {
      head.push(property(target, value));
      consumed.add(name);
    }
  }
  if (rule.tag !== node.tag) {
    head.push(property('tag', node.tag));
  }
  if (rule.level) {
    head.push(property('level', String(rule.level)));
  }
  return { head, consumed };
}

function attrValue(attrs, name) {
  return attrs.find(([key]) => key === name)?.[1];
}

/**
 * Import an HTML string (Node.js, Bun, Deno and browsers).
 * @param {string} text
 * @param {import('../index.js').ImportOptions} [options]
 */
export function importHtml(text, options = {}) {
  if (typeof text !== 'string') {
    throw new TypeError('importHtml expects HTML text (a string)');
  }
  const roots = readHtml(text, options);
  return new Importer(roots, options).run(roots, options);
}

/**
 * Import a live DOM subtree (browsers and jsdom). The result also has
 * `nodeMap`: link id -> the original DOM `Node`.
 * @param {any} root a `Node`: an element, a document or a fragment
 * @param {import('../index.js').ImportDomOptions} [options]
 */
export function importDom(root, options = {}) {
  if (!root || typeof root.nodeType !== 'number') {
    throw new TypeError('importDom expects a DOM Node');
  }
  const roots = readDom(root, options);
  return new Importer(roots, { ...options, keepNodes: true }).run(
    roots,
    options
  );
}
