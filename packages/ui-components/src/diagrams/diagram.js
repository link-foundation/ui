/**
 * `<ui-diagram>`: a diagram written in Links Notation, drawn by our SVG
 * renderer (flowchart and state kinds) after a registered layout (Dagre by
 * default), or by the lazily loaded Mermaid adapter for `(renderer mermaid)`
 * and for the kinds our renderer does not draw (sequence, class).
 *
 * The drawing has `role="img"` and an `aria-label`; a visually hidden list
 * of the nodes and connections ("Start leads to Signed in?") follows it for
 * screen readers. Like the ui-dom elements it is a plain custom element in
 * the light DOM.
 *
 * ```html
 * <ui-diagram>(f: diagram (a: node) (b: node) (edge (from a) (to b)))</ui-diagram>
 * ```
 */

import { describeDiagram, parseDiagram } from './diagram-model.js';
import { runLayout } from './layout-plugins.js';
import { toMermaid } from './mermaid-export.js';
import {
  defineMermaidView,
  setState,
  showSource,
  visuallyHiddenStyle,
} from './mermaid-view.js';
import { SVG_KINDS, diagramSummary, renderDiagramSvg } from './svg-diagram.js';

/** @typedef {import('./diagram-model.js').DiagramModel} DiagramModel */

/**
 * Which renderer draws a model: the `renderer` attribute, then
 * `(renderer …)`, then `svg` for the kinds our renderer draws.
 * @param {DiagramModel} model
 * @param {string|null} [override]
 * @returns {'svg'|'mermaid'}
 */
export function pickRenderer(model, override = null) {
  const wanted = override ?? model.renderer;
  if (wanted === 'svg' || wanted === 'mermaid') {
    return wanted === 'svg' && !SVG_KINDS.includes(model.kind)
      ? 'mermaid'
      : wanted;
  }
  return SVG_KINDS.includes(model.kind) ? 'svg' : 'mermaid';
}

/** The visually hidden description: nodes, then connections. */
function descriptionOf(doc, model) {
  const { nodes, edges } = describeDiagram(model);
  const wrap = doc.createElement('div');
  wrap.className = 'ui-diagram-description';
  wrap.setAttribute('style', visuallyHiddenStyle());
  const title = model.label ?? model.id;
  for (const [name, items] of [
    [`Nodes of ${title}`, nodes],
    [`Connections of ${title}`, edges],
  ]) {
    if (items.length === 0) {
      continue;
    }
    const list = doc.createElement('ul');
    list.setAttribute('aria-label', name);
    for (const text of items) {
      const item = doc.createElement('li');
      item.textContent = text;
      list.appendChild(item);
    }
    wrap.appendChild(list);
  }
  return wrap;
}

let instances = 0;

/**
 * The `<ui-diagram>` class for a window.
 * @param {Window & typeof globalThis} win
 */
function diagramClass(win) {
  return class Diagram extends win.HTMLElement {
    static get observedAttributes() {
      return ['renderer', 'layout'];
    }

    constructor() {
      super();
      /** @type {string|null} */
      this._source = null;
      this._run = 0;
      instances += 1;
      this._idPrefix = `ui-diagram-${instances}`;
      /** Options of the layout engine (`nodeSize`, `rankSep`, …). */
      this.layoutOptions = {};
      /** Tokens of the SVG renderer (`surface`, `onSurface`, …). */
      this.tokens = {};
      /** @type {DiagramModel|null} the model of the last render */
      this.model = null;
    }

    /** The LiNo source (defaults to the text content at first connect). */
    get source() {
      return this._source ?? '';
    }

    set source(value) {
      this._source = String(value);
      if (this.isConnected) {
        this.refresh();
      }
    }

    connectedCallback() {
      if (this._source === null) {
        this._source = (this.textContent ?? '').trim();
      }
      this.refresh();
    }

    attributeChangedCallback(name, before, after) {
      if (before !== after && this.isConnected && this._source !== null) {
        this.refresh();
      }
    }

    /** Render again; resolves to the state reached. */
    async refresh() {
      const run = ++this._run;
      const source = this.source;
      const doc = this.ownerDocument;
      let model;
      try {
        model = parseDiagram(source);
      } catch (error) {
        showSource(this, source, `The diagram has an error: ${error.message}`);
        this.model = null;
        setState(this, 'error', { error });
        return 'error';
      }
      this.model = model;
      const renderer = pickRenderer(model, this.getAttribute('renderer'));
      this.dataset.renderer = renderer;
      if (renderer === 'mermaid') {
        defineMermaidView(win);
        const view = doc.createElement('ui-mermaid-view');
        view.setAttribute('label', diagramSummary(model));
        view.source = toMermaid(model);
        this.replaceChildren(view, descriptionOf(doc, model));
        setState(this, 'ready', { renderer });
        return 'ready';
      }
      setState(this, 'loading', { renderer });
      let svg;
      try {
        const layout = await runLayout(
          model,
          this.layoutOptions,
          this.getAttribute('layout') ?? undefined
        );
        svg = renderDiagramSvg(model, layout, {
          ...this.tokens,
          idPrefix: this._idPrefix,
        });
      } catch (error) {
        if (run !== this._run) {
          return this.dataset.state;
        }
        showSource(
          this,
          source,
          `The diagram could not be laid out: ${error.message}`
        );
        setState(this, 'error', { error });
        return 'error';
      }
      if (run !== this._run) {
        return this.dataset.state;
      }
      const figure = doc.createElement('div');
      figure.className = 'ui-diagram-drawing';
      // Our own SVG string: every label in it is escaped by renderDiagramSvg.
      figure.innerHTML = svg;
      this.replaceChildren(figure, descriptionOf(doc, model));
      setState(this, 'ready', { renderer });
      return 'ready';
    }
  };
}

/**
 * Define `<ui-diagram>` (and `<ui-mermaid-view>`, which it uses) in a window,
 * once.
 * @param {Window & typeof globalThis} [win]
 * @returns {CustomElementConstructor}
 */
export function defineDiagram(win = globalThis) {
  defineMermaidView(win);
  const existing = win.customElements.get('ui-diagram');
  if (existing) {
    return existing;
  }
  const Diagram = diagramClass(win);
  win.customElements.define('ui-diagram', Diagram);
  return Diagram;
}
