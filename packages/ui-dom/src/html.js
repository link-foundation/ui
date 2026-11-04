/**
 * `renderToHTML(source, options)`: the static HTML of a document, with the
 * same custom element tags and `data-link-id` attributes as `render`, for
 * server rendering and snapshots. It needs no DOM: the kinds build into a
 * minimal static document, serialized with every text and attribute value
 * escaped. No `on*` attribute and no `<script>` is ever written.
 */

import { parse } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
import { createTree } from './tree.js';
import { applyThemes } from './themes.js';

const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source']);

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape `& < > " '` (text content and attribute values alike). */
export function escapeHtml(text) {
  let out = '';
  for (const c of String(text)) {
    out += Object.hasOwn(ESCAPES, c) ? ESCAPES[c] : c;
  }
  return out;
}

class StaticNode {
  constructor(document) {
    this.ownerDocument = document;
    this.parentNode = null;
    this.childNodes = [];
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }
  appendChild(node) {
    return this.insertBefore(node, null);
  }
  insertBefore(node, ref) {
    node.parentNode?.removeChild(node);
    const i = ref === null ? -1 : this.childNodes.indexOf(ref);
    this.childNodes.splice(i < 0 ? this.childNodes.length : i, 0, node);
    node.parentNode = this;
    return node;
  }
  removeChild(node) {
    const i = this.childNodes.indexOf(node);
    if (i >= 0) {
      this.childNodes.splice(i, 1);
      node.parentNode = null;
    }
    return node;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
}

class StaticText extends StaticNode {
  constructor(document, data) {
    super(document);
    this.nodeType = 3;
    this.data = String(data);
  }
}

/** `element.style` with the `name: value;` serialization of the DOM. */
class StaticStyle {
  constructor(element) {
    this.element = element;
    this.values = new Map();
  }
  setProperty(name, value) {
    this.values.set(name, String(value));
    this.sync();
  }
  removeProperty(name) {
    this.values.delete(name);
    this.sync();
  }
  getPropertyValue(name) {
    return this.values.get(name) ?? '';
  }
  get cssText() {
    return [...this.values].map(([n, v]) => `${n}: ${v};`).join(' ');
  }
  sync() {
    if (this.values.size === 0) {
      this.element.removeAttribute('style');
    } else {
      this.element.setAttribute('style', this.cssText);
    }
  }
}

class StaticElement extends StaticNode {
  constructor(document, tag) {
    super(document);
    this.nodeType = 1;
    this.localName = String(tag).toLowerCase();
    this.attributes = new Map();
    this.style = new StaticStyle(this);
  }
  setAttribute(name, value) {
    this.attributes.set(String(name).toLowerCase(), String(value));
  }
  getAttribute(name) {
    return this.attributes.get(String(name).toLowerCase()) ?? null;
  }
  hasAttribute(name) {
    return this.attributes.has(String(name).toLowerCase());
  }
  removeAttribute(name) {
    this.attributes.delete(String(name).toLowerCase());
  }
  toggleAttribute(name, force) {
    const on = force ?? !this.hasAttribute(name);
    if (on && !this.hasAttribute(name)) {
      this.setAttribute(name, '');
    } else if (!on) {
      this.removeAttribute(name);
    }
    return on;
  }
  get textContent() {
    return this.childNodes
      .map((n) => (n.nodeType === 3 ? n.data : n.textContent))
      .join('');
  }
  /** The attribute selectors used by static control templates. */
  querySelector(selector) {
    const attribute = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
    for (const child of this.children) {
      const matches = attribute
        ? child.hasAttribute(attribute[1]) &&
          (attribute[2] === undefined ||
            child.getAttribute(attribute[1]) === attribute[2])
        : child.localName === selector;
      if (matches) {
        return child;
      }
      const descendant = child.querySelector(selector);
      if (descendant) {
        return descendant;
      }
    }
    return null;
  }
  // Static output: events never happen.
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
}

/** The minimal document the kinds build into (no window, no scripts). */
export function createStaticDocument() {
  const document = {
    defaultView: null,
    title: '',
    createElement: (tag) => new StaticElement(document, tag),
    createTextNode: (data) => new StaticText(document, data),
  };
  return document;
}

/** Serialize a static node. */
export function serialize(node) {
  if (node.nodeType === 3) {
    return escapeHtml(node.data);
  }
  if (node.localName === 'script') {
    return '';
  }
  let attributes = '';
  for (const [name, value] of node.attributes) {
    if (!name.startsWith('on')) {
      attributes += ` ${name}="${escapeHtml(value)}"`;
    }
  }
  const open = `<${node.localName}${attributes}>`;
  if (VOID.has(node.localName)) {
    return open;
  }
  return `${open}${node.childNodes.map(serialize).join('')}</${node.localName}>`;
}

const isStore = (source) =>
  typeof source?.subscribe === 'function' &&
  typeof source?.roots === 'function';

/** A store of the source: LiNo text, a UiDocument, nodes, or a store. */
function storeOf(source, report) {
  if (isStore(source)) {
    return source;
  }
  if (typeof source === 'string') {
    const parsed = parse(source);
    parsed.diagnostics.forEach(report);
    return createStore({ document: parsed });
  }
  if (Array.isArray(source)) {
    return createStore({ document: { roots: source } });
  }
  if (Array.isArray(source?.roots)) {
    return createStore({ document: source });
  }
  return createStore({ document: { roots: [source] } });
}

/**
 * @param {string|import('@link-foundation/ui-store').Store|
 *   import('@link-foundation/ui-core').UiDocument|
 *   import('@link-foundation/ui-core').UiNode|
 *   import('@link-foundation/ui-core').UiNode[]} source
 * @param {{kinds?: Map<string, object>|Record<string, object>,
 *   onDiagnostic?: (diagnostic: object) => void, prefix?: string}} [options]
 * @returns {string}
 */
export function renderToHTML(source, options = {}) {
  const report = (d) => options.onDiagnostic?.(d);
  const document = createStaticDocument();
  const container = document.createElement('template');
  const store = storeOf(source, report);
  const tree = createTree({
    document,
    container,
    options,
    interactive: false,
    report,
  });
  tree.mount(store);
  applyThemes(tree, store, options);
  return container.childNodes.map(serialize).join('');
}
