/**
 * The shared base of the chart custom elements (`<ui-chart>`,
 * `<ui-stat-tile>`, `<ui-gauge>`, `<ui-sparkline>`): where the spec comes
 * from, the chart style sheet, the data table twin and error reporting.
 *
 * The elements render into their light DOM, so page styles and the token
 * custom properties apply. Every element is built for a given window (a
 * browser window, or a jsdom window in tests), so nothing touches globals.
 */

import { chartFromLinks, chartToLino, parseChart } from './chart-model.js';
import { atomNode, formatNode, parseLino, prop } from './lino.js';
import { renderSmallChartSvg } from './small-svg.js';
import { chartTable } from './summary.js';
import { CHART_CSS } from './tokens.js';

/** The `<script>` type of an inline spec: `<script type="text/lino">`. */
export const LINO_SCRIPT_TYPE = 'text/lino';

const counters = new WeakMap();

/** An ID that is unique in the document: `ui-chart-1`, `ui-chart-2`... */
export function uniqueId(document, prefix = 'ui-chart') {
  const next = (counters.get(document) ?? 0) + 1;
  counters.set(document, next);
  return `${prefix}-${next}`;
}

/** Add the chart style sheet to the document once. */
export function ensureChartStyles(document) {
  if (document.querySelector('style[data-ui-chart]') !== null) {
    return;
  }
  const style = document.createElement('style');
  style.setAttribute('data-ui-chart', '');
  style.textContent = CHART_CSS;
  (document.head ?? document.documentElement).append(style);
}

/**
 * The data table twin of a chart: a caption, column headers, and one row
 * per data row. Built with DOM methods, so every value is text.
 * @param {Document} document
 * @param {object} spec
 * @param {string} id
 */
export function createTable(document, spec, id) {
  const { caption, columns, numeric, rows } = chartTable(spec);
  const table = document.createElement('table');
  table.id = id;
  table.className = 'ui-chart-table';
  const captionEl = document.createElement('caption');
  captionEl.textContent = caption;
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const column of columns) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = column;
    headRow.append(th);
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    row.forEach((value, i) => {
      const td = document.createElement('td');
      td.textContent = value;
      if (numeric[i]) {
        td.style.textAlign = 'end';
      }
      tr.append(td);
    });
    body.append(tr);
  }
  table.append(captionEl, head, body);
  return table;
}

/** A `<div>` with a class name. */
export function div(document, className) {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

/**
 * The base class of the chart elements in a window. Subclasses set
 * `static kinds` (the chart kinds they show) and implement `draw(spec)`,
 * which returns the nodes to show.
 * @param {Window} win
 */
export function createChartElementClass(win) {
  return class ChartElement extends win.HTMLElement {
    /** @type {string[]|null} the kinds this element shows; null: any */
    static kinds = null;

    #lino = null;
    #spec = null;
    #rendered = null;
    #output = [];

    /** The LiNo text of the chart; setting it renders the element again. */
    get lino() {
      return this.#lino ?? this.inlineLino();
    }

    set lino(text) {
      this.#lino = text === null ? null : String(text);
      this.#spec = null;
      this.update();
    }

    /** The normalised spec shown (`null` before the first render). */
    get spec() {
      return this.#rendered;
    }

    /** Show a spec object (as `chartFromLinks` returns). */
    set spec(spec) {
      this.#spec = spec;
      this.#lino = null;
      this.update();
    }

    connectedCallback() {
      if (this.#rendered === null) {
        this.update();
      }
    }

    /** The text of the inline `<script type="text/lino">` child, or null. */
    inlineLino() {
      const script = [...this.children].find(
        (child) =>
          child.localName === 'script' &&
          child.getAttribute('type') === LINO_SCRIPT_TYPE
      );
      return script === undefined ? null : script.textContent;
    }

    /** LiNo text built from the attributes (small charts), or null. */
    attributeLino() {
      return null;
    }

    /** The spec to show, read and checked by the chart model. */
    readSpec() {
      if (this.#spec !== null) {
        // Normalise (and check) a spec object by writing and reading it.
        return parseChart(chartToLino(this.#spec));
      }
      const text = this.lino ?? this.attributeLino();
      if (text === null) {
        return null;
      }
      const spec = chartFromLinks(parseLino(text));
      const { kinds } = this.constructor;
      if (kinds !== null && !kinds.includes(spec.kind)) {
        throw new TypeError(
          `<${this.localName}> shows ${kinds.join(', ')}, not ${spec.kind}`
        );
      }
      return spec;
    }

    /** Render the element again from its current source. */
    update() {
      const document = this.ownerDocument;
      ensureChartStyles(document);
      this.#output.forEach((node) => node.remove());
      let spec;
      try {
        spec = this.readSpec();
      } catch (error) {
        this.#rendered = null;
        this.show([this.errorNode(error)]);
        this.dispatchEvent(
          new win.CustomEvent('chart-error', { detail: error, bubbles: true })
        );
        return;
      }
      this.#rendered = spec;
      this.show(spec === null ? [] : this.draw(spec));
    }

    /** Append the rendered nodes, remembering them for the next update. */
    show(nodes) {
      this.#output = nodes;
      this.append(...nodes);
    }

    /** The message of a spec that cannot be shown. */
    errorNode(error) {
      const p = this.ownerDocument.createElement('p');
      p.className = 'ui-chart-error';
      p.setAttribute('role', 'alert');
      p.textContent = `Chart error: ${error.message}`;
      return p;
    }

    /**
     * The nodes of a spec.
     * @param {object} spec
     * @returns {Node[]}
     */
    // eslint-disable-next-line no-unused-vars
    draw(spec) {
      return [];
    }
  };
}

/**
 * Define a custom element in a window unless the tag is taken.
 * @param {Window} win
 * @param {string} tag
 * @param {(win: Window) => CustomElementConstructor} create
 */
export function defineElement(win, tag, create) {
  const registry = win?.customElements;
  if (registry === undefined) {
    throw new TypeError('defineChartElements needs a window');
  }
  const existing = registry.get(tag);
  if (existing !== undefined) {
    return existing;
  }
  const constructor = create(win);
  registry.define(tag, constructor);
  return constructor;
}

/**
 * LiNo text of a small chart from element attributes: `(id: kind (name
 * value...) ...)`. Written with the links-notation writer, so attribute
 * values are escaped, and read back by the chart model, which checks them.
 * @param {Element} element
 * @param {string} kind
 * @param {string[]} names  the attributes, in order
 * @param {string[]} [lists]  the attributes that hold numbers split by spaces
 * @returns {string|null}  null when none of the attributes is set
 */
export function attributesLino(element, kind, names, lists = []) {
  const props = names
    .filter((name) => element.hasAttribute(name))
    .map((name) => {
      const value = element.getAttribute(name);
      return lists.includes(name)
        ? prop(name, ...value.split(/\s+/u).filter(Boolean))
        : prop(name, value);
    });
  if (props.length === 0) {
    return null;
  }
  const id = element.id === '' ? kind : element.id;
  return formatNode({ id, values: [atomNode(kind), ...props] });
}

/**
 * A small chart (stat tile, gauge, sparkline): its SVG and a visually
 * hidden data table twin in a box.
 * @param {Document} document
 * @param {object} spec
 * @param {string} [className]
 * @param {string} [tag]
 */
export function drawSmallChart(
  document,
  spec,
  className = `ui-${spec.kind}`,
  tag = 'div'
) {
  const box = document.createElement(tag);
  box.className = className;
  box.innerHTML = renderSmallChartSvg(spec);
  const table = createTable(document, spec, uniqueId(document));
  table.classList.add('ui-visually-hidden');
  box.append(table);
  return box;
}

/**
 * The class of a small chart element (`<ui-stat-tile>`, `<ui-gauge>`,
 * `<ui-sparkline>`): its SVG (`role="img"` with an accessible name) and a
 * visually hidden data table twin.
 * @param {Window} win
 * @param {{kind: string, className: string, names: string[], lists?: string[], tag?: string}} options
 */
export function createSmallChartClass(win, options) {
  const { kind, className, names, lists = [], tag = 'div' } = options;
  return class SmallChartElement extends createChartElementClass(win) {
    static kinds = [kind];

    static observedAttributes = names;

    attributeChangedCallback() {
      if (this.isConnected) {
        this.update();
      }
    }

    attributeLino() {
      return attributesLino(this, kind, names, lists);
    }

    draw(spec) {
      return [drawSmallChart(this.ownerDocument, spec, className, tag)];
    }
  };
}
