/**
 * The shared step of the JSX and Vue importers: component nodes -> element
 * links of the UI dialect.
 *
 * A front end (`jsx/import.js`, `vue/import.js`) reads its source into
 * component nodes: the intermediate form of the HTML importer
 * (`html/tree.js`) whose attributes are already sorted by what they become:
 *
 * - `literal`: a static value (`label="Email"`, `spacing={2}`), matched by
 *   the mapping rules and otherwise kept as `(attr name value)`;
 * - `style`: CSS declarations (`style={{ padding: 8 }}`, `sx`);
 * - `link`: a ready link (`(on press (action save))`, `(bind ...)`);
 * - `unsupported`: a construct that cannot be imported, kept as
 *   `(unsupported <construct> '<source>')` with a diagnostic.
 *
 * Every element is mapped by the first of: the rules of the mappings
 * (`mui.lino`, `rules.js`), the HTML mapping table for lowercase tags, the
 * `html` fallback with `(tag Name)`. Ids follow the HTML importer
 * (`ids.js`) with the kind as the stem: `stack-0`, `button-0-1`.
 */

import { Link } from 'links-notation';
import { SPEC_VERSION, format, projectLinks } from '@link-foundation/ui-core';
import { assignIds } from '../html/ids.js';
import { mapHtmlElement } from '../html/import.js';
import { HTML_FALLBACK_KIND } from '../html/mapping.js';
import {
  DROPPED_TAGS,
  droppedScript,
  unsafeAttribute,
} from '../html/security.js';
import { parseStyle, styleLink } from '../html/style.js';
import { TEXT } from '../html/tree.js';
import { componentVocabulary, loadMappings } from '../mappings/index.js';
import { applyRules } from '../rules.js';

/** The tag of a child that cannot be imported (`{items.map(...)}`). */
export const UNSUPPORTED = '#unsupported';

/** The tag of a node that is already a link (a Vue `<script>` block). */
export const RAW = '#raw';

/**
 * @typedef {import('../html/tree.js').Span} Span
 * @typedef {{ kind: 'literal', name: string, value: string, span?: Span }
 *   | { kind: 'style', declarations: [string, string][], span?: Span }
 *   | { kind: 'link', link: Link, span?: Span }
 *   | { kind: 'unsupported', construct: string, source: string,
 *       message: string, span?: Span }} ComponentProp
 * @typedef {{
 *   tag: string,
 *   props?: ComponentProp[],
 *   children?: ComponentNode[],
 *   text?: string,
 *   span?: Span,
 *   construct?: string,
 *   source?: string,
 *   message?: string,
 *   kind?: string,
 *   stem?: string,
 *   items?: Link[],
 *   diagnostic?: { code: string, severity: string, message: string },
 * }} ComponentNode
 */

const atom = (text) => new Link(text);
const property = (name, ...values) =>
  new Link(null, [atom(name), ...values.map(atom)]);

/** A term of `rules.js` as a link: an atom or `(a b ...)`. */
const termLink = (term) =>
  typeof term === 'string' ? atom(term) : new Link(null, term.map(termLink));

/** JSX names of HTML attributes. */
const ATTRIBUTE_NAMES = { className: 'class', htmlFor: 'for' };

const isUpper = (c) => c >= 'A' && c <= 'Z';

/** Whether a tag is an HTML element (`div`), not a component (`Button`). */
const isHtmlTag = (tag) => !isUpper(tag[0]) && !tag.includes('.');

/** A component name as an id stem: `CardHeader` -> `card-header`. */
export function kebabCase(name) {
  let out = '';
  for (const c of name) {
    if (isUpper(c)) {
      out += out === '' || out.endsWith('.') ? c.toLowerCase() : `-${c}`;
    } else {
      out += c;
    }
  }
  return out.toLowerCase();
}

/** The text of the children when they are all text, otherwise `null`. */
const textOf = (children) =>
  children.length > 0 && children.every((child) => child.tag === TEXT)
    ? children
        .map((child) => child.text)
        .join('')
        .trim()
    : null;

const attrLink = ([name, value]) =>
  value === '' ? property('attr', name) : property('attr', name, value);

class ComponentImporter {
  constructor(options) {
    this.vocabulary = options.vocabulary ?? componentVocabulary();
    this.rules = loadMappings(options.mappings ?? ['mui']);
    this.diagnostics = [];
    this.spans = new Map();
    this.applied = new Map();
  }

  /**
   * First pass: map one node and plan its link. Returns a view node for
   * `assignIds` (`tag` is the id stem) or `null` when the node is dropped.
   */
  plan(node, notes) {
    if (node.tag === TEXT) {
      return { tag: 'text', attrs: [], children: [], node, notes: [] };
    }
    if (node.tag === RAW) {
      return { tag: node.stem, attrs: [], children: [], node, notes: [] };
    }
    if (DROPPED_TAGS.includes(node.tag)) {
      notes.push(this.dropped(`the <${node.tag}> element`, node.span));
      return null;
    }
    const own = [];
    const { literals, styles, links, unsupported } = this.sort(
      node.props ?? [],
      own
    );
    const children = [];
    for (const child of node.children ?? []) {
      if (child.tag === UNSUPPORTED) {
        unsupported.push(child);
      } else {
        const view = this.plan(child, own);
        if (view) {
          children.push(view);
        }
      }
    }
    const mapped = this.map(node, literals, children);
    return {
      tag: mapped.stem,
      attrs: literals.filter(([name]) => name === 'id'),
      children: mapped.children,
      node,
      notes: [...own, ...mapped.notes],
      mapped,
      styles,
      links,
      unsupported,
    };
  }

  /** Sort the props of an element by what they become. */
  sort(props, notes) {
    const out = { literals: [], styles: [], links: [], unsupported: [] };
    for (const prop of props) {
      if (prop.kind === 'literal') {
        const name = ATTRIBUTE_NAMES[prop.name] ?? prop.name;
        const unsafe = unsafeAttribute(name, prop.value);
        if (unsafe) {
          notes.push(this.dropped(unsafe, prop.span));
        } else if (name === 'style') {
          out.styles.push(...parseStyle(prop.value));
        } else {
          out.literals.push([name, prop.value]);
        }
      } else if (prop.kind === 'style') {
        out.styles.push(...prop.declarations);
      } else if (prop.kind === 'link') {
        out.links.push(prop.link);
      } else {
        out.unsupported.push(prop);
      }
    }
    return out;
  }

  /** Map an element: rules, then the HTML table, then the fallback. */
  map(node, literals, children) {
    const nodes = children.map((view) => view.node);
    const text = textOf(nodes);
    const term = [
      node.tag,
      ...literals.map(([name, value]) => [name, value]),
      ...(text === null ? [] : [['children', text]]),
    ];
    const ruled = applyRules(term, this.rules);
    const kind = ruled.node[0];
    const spec = this.vocabulary.kinds.get(kind);
    if (ruled.applied.length > 0 && spec) {
      const usedText = ruled.consumed.some((item) => item[0] === 'children');
      const rest = usedText ? [] : children;
      if (spec.children !== 'none' || rest.length === 0) {
        return {
          stem: kind,
          head: [atom(kind), ...ruled.node.slice(1).map(termLink)],
          attrs: ruled.rest
            .filter((item) => item[0] !== 'children')
            .map(([name, value]) => [name, value]),
          children: rest,
          applied: ruled.applied[0],
          notes: [],
        };
      }
    }
    if (isHtmlTag(node.tag)) {
      const html = mapHtmlElement(
        { tag: node.tag, attrs: literals, children: nodes },
        nodes,
        literals,
        this.vocabulary
      );
      if (html) {
        return {
          stem: node.tag,
          head: html.head,
          attrs: html.attrs,
          children: html.children.length === 0 ? [] : children,
          notes: [],
        };
      }
    }
    return {
      stem: isHtmlTag(node.tag) ? node.tag : kebabCase(node.tag),
      head: [atom(HTML_FALLBACK_KIND), property('tag', node.tag)],
      attrs: literals,
      children,
      notes: isHtmlTag(node.tag)
        ? []
        : [
            {
              code: 'unmapped-component',
              severity: 'info',
              message: `No mapping rule matches <${node.tag}>; it is kept as (html (tag ${node.tag}))`,
              span: node.span,
            },
          ],
    };
  }

  dropped(what, span) {
    return { ...droppedScript(null, what), span };
  }

  report(id, note) {
    const { code, severity, message, span } = note;
    this.diagnostics.push({ code, severity, message, span, id });
  }

  /** Second pass: the element link of a planned node. */
  link(view) {
    const id = this.ids.get(view);
    const { node } = view;
    if (node.span) {
      this.spans.set(id, node.span);
    }
    if (node.tag === TEXT) {
      return new Link(id, [atom('text'), atom(node.text)]);
    }
    if (node.tag === RAW) {
      this.report(id, { ...node.diagnostic, span: node.span });
      return new Link(id, [atom(node.kind), ...node.items]);
    }
    const { mapped } = view;
    if (mapped.applied) {
      this.applied.set(id, mapped.applied);
    }
    for (const note of view.notes) {
      this.report(id, note);
    }
    const unsupported = view.unsupported.map((item) => {
      this.report(id, {
        code: `unsupported-${item.construct}`,
        severity: 'warning',
        message: item.message,
        span: item.span,
      });
      return property('unsupported', item.construct, item.source);
    });
    return new Link(id, [
      ...mapped.head,
      ...mapped.attrs
        .filter(([name, value]) => !(name === 'id' && value === id))
        .map(attrLink),
      ...[styleLink(view.styles)].filter(Boolean),
      ...view.links,
      ...unsupported,
      ...view.children.map((child) => this.link(child)),
    ]);
  }

  run(roots, options) {
    const notes = [];
    const views = roots
      .map((root) => this.plan(root, notes))
      .filter((view) => view !== null);
    this.ids = assignIds(views);
    for (const note of notes) {
      this.report(null, note);
    }
    const links = views.map((view) => this.link(view));
    const projected = projectLinks(links, this.vocabulary);
    const tree = { spec: SPEC_VERSION, ...projected };
    const text = format(tree, {
      style: options.style ?? 'multiline',
      indent: options.indent,
    });
    return {
      text,
      tree,
      links,
      spans: this.spans,
      applied: this.applied,
      diagnostics: [...this.diagnostics, ...projected.diagnostics],
    };
  }
}

/**
 * Import component nodes (see the module comment).
 * @param {ComponentNode[]} roots
 * @param {{ mappings?: string[], vocabulary?: any, style?: string,
 *   indent?: string }} [options]
 */
export function importComponents(roots, options = {}) {
  return new ComponentImporter(options).run(roots, options);
}

/**
 * The `(unsupported ...)` prop or child of a construct.
 * @param {string} construct `jsx-expression`, `vue-directive`, ...
 * @param {string} source the source text
 * @param {Span} span
 * @param {string} message
 */
export const unsupportedProp = (construct, source, span, message) => ({
  kind: 'unsupported',
  construct,
  source,
  span,
  message,
});

/**
 * `(on <event> (action <name>))`.
 * @param {string} event
 * @param {string} name
 */
export const actionLink = (event, name) =>
  new Link(null, [
    atom('on'),
    atom(event),
    new Link(null, [atom('action'), atom(name)]),
  ]);

/** `(param path)`. */
export const paramLink = (path) => new Link(null, [atom('param'), atom(path)]);
