/**
 * The `<ui-chart>` element: a chart of the chart dialect, accessible to
 * keyboard and screen reader users.
 *
 * - The chart is a deterministic SVG (`renderChartSvg`) with `role="img"`
 *   and an `aria-label` from `(description ...)` (else the title, else a
 *   summary computed from the data).
 * - A data table twin is always in the page, visually hidden; the "Show
 *   data table" button (`aria-expanded`) shows it.
 * - The plot is focusable: Left and Right move between the points of a
 *   series, Up and Down between series, Home and End to the first and last
 *   point, Escape hides the tooltip. The value of the point is shown in a
 *   tooltip and announced through an `aria-live` region.
 * - `(renderer echarts)` loads the ECharts adapter, and ECharts itself, on
 *   first use only; until it loads (or if it fails) the SVG is shown.
 *
 * The spec is an inline `<script type="text/lino">` child, or the `lino`
 * (text) or `spec` (object) property.
 */

import {
  createChartElementClass,
  createTable,
  defineElement,
  div,
  drawSmallChart,
  uniqueId,
} from './element.js';
import { chartDocument, chartPresentation } from './document.js';
import { movePoint, navigable, pointAt } from './point-navigation.js';
import { tooltipContent, showTopTooltip } from './tooltip.js';
import { supportsECharts } from './renderer-features.js';
import { layoutChart } from './layout.js';
import { virtualAnchor } from '../overlays/position.js';
import { summarizeChart } from './summary.js';
import { layoutToSvg } from './svg-renderer.js';

/** The tag of the element. */
export const CHART_TAG = 'ui-chart';

const SVG_NS = 'http://www.w3.org/2000/svg';
const POINTER_REACH = 24;

/** The show / hide text of the table toggle. */
const toggleText = (shown) => (shown ? 'Hide data table' : 'Show data table');

/** The number of points a keyboard user can reach. */
const pointCount = (layout) =>
  navigable(layout).reduce((sum, series) => sum + series.points.length, 0);

/** The focusable plot: the SVG (`role="img"`) and the tooltip. */
function createCanvas(document, layout) {
  const canvas = div(document, 'ui-chart-canvas');
  canvas.innerHTML = layoutToSvg(layout);
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'group');
  canvas.setAttribute('aria-roledescription', 'chart');
  canvas.setAttribute('aria-label', layout.label);
  const tooltip = div(document, 'ui-chart-tooltip');
  tooltip.setAttribute('role', 'tooltip');
  tooltip.id = uniqueId(document);
  tooltip.hidden = true;
  if (!chartDocument(document).configured) {
    canvas.append(tooltip);
  }
  return { canvas, tooltip };
}

/**
 * The canvas, tooltip, keyboard hint, live region, summary, table toggle
 * and table of a chart (no listeners).
 * @param {Document} document
 * @param {object} spec
 * @param {object} layout
 */
function createParts(document, spec, layout) {
  const { canvas, tooltip } = createCanvas(document, layout);
  const count = pointCount(layout);
  const hint = div(document, 'ui-chart-hint ui-visually-hidden');
  hint.id = uniqueId(document);
  hint.textContent =
    count === 0
      ? 'The chart has no data points.'
      : `${count} data points. Use the arrow keys to move between them, Up and Down to change series.`;
  canvas.setAttribute('aria-describedby', hint.id);
  const live = div(document, 'ui-chart-live ui-visually-hidden');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  const summary = document.createElement('figcaption');
  summary.className = 'ui-chart-summary';
  summary.textContent = summarizeChart(spec);
  const table = createTable(document, spec, uniqueId(document));
  table.classList.add('ui-visually-hidden');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'ui-chart-toggle';
  toggle.textContent = toggleText(false);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', table.id);
  const figure = document.createElement('figure');
  figure.className = 'ui-chart-figure';
  figure.append(canvas, hint, live, summary, toggle, table);
  return { figure, canvas, hint, tooltip, live, summary, toggle, table };
}

/** The announcement of a point: its value and where it is. */
function announcement(series, s, i) {
  const { points } = series[s];
  const where =
    series.length > 1
      ? `point ${i + 1} of ${points.length}, series ${s + 1} of ${series.length}`
      : `point ${i + 1} of ${points.length}`;
  return `${points[i].text}, ${where}`;
}

/** The point nearest to (x, y) in layout pixels, within reach, or null. */
function nearestPoint(layout, x, y) {
  let best = null;
  for (const series of navigable(layout)) {
    for (const point of series.points) {
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance <= POINTER_REACH && (!best || distance < best.d)) {
        best = { point, d: distance };
      }
    }
  }
  return best?.point ?? null;
}

/** The scale of the drawn SVG to layout pixels (1 when unknown). */
function svgScale(canvas, layout) {
  const svg = canvas.querySelector('svg');
  const drawn = svg?.getBoundingClientRect().width ?? 0;
  return drawn > 0 ? drawn / layout.width : 1;
}

/** Draw (or move) the ring around the active point in an SVG. */
function placeFocusRing(svg, point) {
  let ring = svg.querySelector('.ui-chart-focus');
  if (ring === null) {
    ring = svg.ownerDocument.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('class', 'ui-chart-focus');
    ring.setAttribute('r', '8');
    ring.setAttribute('aria-hidden', 'true');
    svg.append(ring);
  }
  ring.setAttribute('cx', String(point.x));
  ring.setAttribute('cy', String(point.y));
}

/**
 * Draw a chart with ECharts in a host over the SVG of a canvas, loading the
 * adapter (and ECharts) on first use.
 * @returns {Promise<object>} the ECharts instance
 */
async function mountECharts(canvas, spec, layout, options) {
  const { renderECharts, toEChartsOption } =
    await import('./echarts-adapter.js');
  const host = div(canvas.ownerDocument, 'ui-chart-echarts');
  host.setAttribute('aria-hidden', 'true');
  host.style.width = `${layout.width}px`;
  host.style.height = `${layout.height}px`;
  canvas.insertBefore(host, canvas.querySelector('svg'));
  const size = { width: layout.width, height: layout.height };
  const { instance } = await renderECharts(host, spec, { ...size, ...options });
  return {
    instance,
    updatePresentation(presentation) {
      instance.setOption(toEChartsOption(spec, { ...size, ...presentation }));
    },
  };
}

function positionPointTooltip(tooltip, canvas, layout, point, pointer, scale) {
  const box = canvas.querySelector('svg').getBoundingClientRect();
  const markBox = canvas
    .querySelector(
      `.ui-chart-marks [data-series="${point.series}"][data-row="${point.row}"]`
    )
    ?.getBoundingClientRect();
  const x =
    pointer?.clientX ??
    (markBox ? markBox.left + markBox.width / 2 : box.left + point.x * scale);
  const y = pointer?.clientY ?? markBox?.top ?? box.top + point.y * scale;
  return showTopTooltip(
    tooltip,
    canvas,
    x,
    y,
    x > box.left + (layout.plot.x + layout.plot.width * 0.6) * scale
  );
}

function showPointTooltip(
  { parts, layout, spec, echarts, stop },
  point,
  pointer
) {
  const { tooltip, canvas } = parts;
  const scale = svgScale(parts.canvas, layout);
  stop?.();
  stop = null;
  tooltipContent(tooltip, point, spec);
  tooltip.style.left = `${point.x * scale}px`;
  tooltip.style.top = `${point.y * scale}px`;
  tooltip.hidden = echarts;
  if (spec.tooltip?.layer === 'top') {
    stop = positionPointTooltip(tooltip, canvas, layout, point, pointer, scale);
  }
  canvas.setAttribute('aria-describedby', tooltip.id);
  const svg = canvas.querySelector('svg');
  if (svg !== null) {
    placeFocusRing(svg, point);
  }
  return stop;
}

function initializeActivity(element, spec, parts, layout, win) {
  if (spec.mark.type === 'calendar') {
    parts.canvas.classList.add('ui-calendar-scroll');
    parts.canvas.setAttribute('role', 'region');
    win.queueMicrotask(() => {
      if (parts.canvas.isConnected) {
        parts.canvas.scrollLeft = parts.canvas.scrollWidth;
      }
    });
  }
  for (const diagnostic of layout.diagnostics) {
    element.dispatchEvent(
      new win.CustomEvent('chart-diagnostic', {
        detail: diagnostic,
        bubbles: true,
      })
    );
  }
}

function toggleParts(parts, show) {
  const { toggle, table } = parts;
  const shown = show ?? toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(shown));
  toggle.textContent = toggleText(shown);
  table.classList.toggle('ui-visually-hidden', !shown);
}

function pointerPoint(canvas, layout, event) {
  const svg = canvas.querySelector('.ui-chart-echarts, svg');
  const box = svg.getBoundingClientRect();
  const scale = box.width > 0 ? box.width / layout.width : 1;
  const x = (event.clientX - box.left) / scale;
  const y = (event.clientY - box.top) / scale;
  const row = event.target.closest?.('[data-row]')?.getAttribute('data-row');
  return row !== undefined && row !== null
    ? (navigable(layout)
        .flatMap((series) => series.points)
        .find((point) => point.row === Number(row)) ??
        nearestPoint(layout, x, y))
    : nearestPoint(layout, x, y);
}

function pointAnchor(canvas, layout, point, echarts) {
  const mark = canvas.querySelector(
    `.ui-chart-marks [data-series="${point.series}"][data-row="${point.row}"]`
  );
  if (!echarts && mark) {
    return mark;
  }
  const drawing = canvas.querySelector('.ui-chart-echarts, svg');
  return {
    contextElement: drawing,
    getBoundingClientRect() {
      const box = drawing.getBoundingClientRect();
      const scale = box.width / layout.width;
      return virtualAnchor(
        box.left + point.x * scale,
        box.top + point.y * scale,
        drawing
      ).getBoundingClientRect();
    },
  };
}

function wireParts(element, document, spec, layout) {
  const parts = createParts(document, spec, layout);
  const { canvas, toggle } = parts;
  toggle.addEventListener('click', () => element.toggleTable());
  canvas.addEventListener('keydown', (event) => element.onKey(event));
  canvas.addEventListener('blur', () => element.hideTooltip());
  canvas.addEventListener('pointermove', (event) => element.onPointer(event));
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch' || !chartDocument(document).configured) {
      element.hideTooltip();
    }
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'touch' && chartDocument(document).configured) {
      element.onPointer(event, true);
    }
  });
  canvas.addEventListener('focusin', (event) => {
    const row = event.target.getAttribute('data-row');
    if (spec.mark.type === 'range' && row !== null) {
      element.focusPoint(0, Number(row));
    }
  });
  canvas.addEventListener('focusout', (event) => {
    if (!canvas.contains(event.relatedTarget)) {
      element.hideTooltip();
    }
  });
  return parts;
}

/**
 * The `<ui-chart>` class of a window.
 * @param {Window} win
 */
// eslint-disable-next-line max-lines-per-function -- The factory binds the element class to its window.
export function createChartClass(win) {
  return class UiChart extends createChartElementClass(win) {
    /** @type {{series: number, index: number}|null} the active point */
    #active = null;
    #layout = null;
    #parts = null;
    #echarts = null;
    #updateECharts = null;
    #resumeECharts = false;
    #stopTooltip = null;

    /** Resolves when the chart (and ECharts, if used) has rendered. */
    ready = Promise.resolve();

    /** Load ECharts (tests and pages may replace it). */
    loadECharts = undefined;

    /** The active point (`{series, index, row, text}`) or null. */
    get activePoint() {
      if (this.#active === null || this.#layout === null) {
        return null;
      }
      const series = navigable(this.#layout)[this.#active.series];
      return series?.points[this.#active.index] ?? null;
    }

    connectedCallback() {
      if (this.#resumeECharts) {
        this.update();
      } else {
        super.connectedCallback();
      }
    }

    disconnectedCallback() {
      this.hideTooltip();
      this.#echarts?.dispose?.();
      this.#echarts = null;
      this.#updateECharts = null;
      this.#resumeECharts =
        this.spec?.renderer === 'echarts' && supportsECharts(this.spec);
      super.disconnectedCallback();
    }

    update() {
      this.hideTooltip();
      this.#echarts?.dispose?.();
      this.#active = null;
      this.#parts = null;
      this.#echarts = null;
      this.#updateECharts = null;
      this.#resumeECharts = false;
      super.update();
    }

    updatePresentation() {
      super.updatePresentation();
      this.#updateECharts?.(chartPresentation(this));
    }

    draw(spec) {
      if (spec.kind !== 'chart') {
        this.#layout = null;
        return [drawSmallChart(this.ownerDocument, spec)];
      }
      const document = this.ownerDocument;
      const width = Number(this.getAttribute('width')) || undefined;
      const height = Number(this.getAttribute('height')) || undefined;
      this.#layout = layoutChart(spec, { width, height });
      const parts = wireParts(this, document, spec, this.#layout);
      this.#parts = parts;
      initializeActivity(this, spec, parts, this.#layout, win);
      this.ready =
        spec.renderer === 'echarts' && supportsECharts(spec)
          ? this.useECharts(spec, parts.canvas)
          : Promise.resolve();
      return [parts.figure];
    }

    /** Show or hide the data table (it is always in the accessibility tree). */
    toggleTable(show) {
      toggleParts(this.#parts, show);
    }

    onKey(event) {
      if (event.key === 'Escape') {
        this.hideTooltip();
        return;
      }
      if (this.#layout !== null) {
        const next = movePoint(
          navigable(this.#layout),
          this.#active,
          event.key,
          this.spec.mark.type === 'calendar'
        );
        if (next) {
          event.preventDefault();
          if (next !== this.#active) {
            this.focusPoint(next.series, next.index);
          }
        }
      }
    }

    /**
     * Move to a point (clamped to the chart), show its tooltip and
     * announce its value.
     * @param {number} seriesIndex
     * @param {number} index
     */
    focusPoint(seriesIndex, index) {
      const series = this.#layout ? navigable(this.#layout) : [];
      const active = pointAt(series, { series: seriesIndex, index });
      if (!active) {
        return;
      }
      this.#active = active;
      const { series: s, index: i, point } = active;
      const shared = chartDocument(this.ownerDocument).configured;
      if (!shared) {
        this.#parts.live.textContent = announcement(series, s, i);
      }
      this.showTooltip(point);
      if (this.#echarts !== null && !shared) {
        const index = this.#layout.series.indexOf(series[s]);
        this.#echarts.dispatchAction({
          type: 'showTip',
          seriesIndex: index,
          dataIndex: i,
        });
      }
      this.dispatchEvent(
        new win.CustomEvent('chart-point', {
          detail: { series: s, index: i, row: point.row, text: point.text },
          bubbles: true,
        })
      );
    }

    showTooltip(point, pointer = null) {
      const shared = chartDocument(this.ownerDocument);
      if (shared.configured) {
        const { canvas } = this.#parts;
        const source =
          pointer === null && canvas.contains(this.ownerDocument.activeElement)
            ? this.ownerDocument.activeElement
            : canvas;
        const svg = canvas.querySelector('svg');
        this.scrollPointIntoView(canvas, point, pointer);
        placeFocusRing(svg, point);
        shared.show(this, {
          source,
          point,
          spec: this.spec,
          event: pointer,
          anchor: pointAnchor(canvas, this.#layout, point, this.#echarts),
        });
        return;
      }
      if (!this.#parts.tooltip.parentNode) {
        this.#parts.canvas.append(this.#parts.tooltip);
      }
      this.scrollPointIntoView(this.#parts.canvas, point, pointer);
      this.#stopTooltip = showPointTooltip(
        {
          parts: this.#parts,
          layout: this.#layout,
          spec: this.spec,
          echarts: this.#echarts !== null,
          stop: this.#stopTooltip,
        },
        point,
        pointer
      );
    }

    scrollPointIntoView(canvas, point, pointer) {
      if (!pointer && this.spec.mark.type === 'calendar') {
        const target = point.x * svgScale(canvas, this.#layout);
        if (
          target < canvas.scrollLeft ||
          target > canvas.scrollLeft + canvas.clientWidth
        ) {
          canvas.scrollLeft = target - canvas.clientWidth / 2;
        }
      }
    }

    hideTooltip() {
      chartDocument(this.ownerDocument).hide(this);
      if (this.#parts === null) {
        return;
      }
      this.#stopTooltip?.();
      this.#stopTooltip = null;
      if (this.#parts.tooltip.hasAttribute('popover')) {
        this.#parts.tooltip.hidePopover?.();
      }
      this.#parts.tooltip.hidden = true;
      this.#parts.canvas.querySelector('.ui-chart-focus')?.remove();
      this.#parts.canvas.setAttribute('aria-describedby', this.#parts.hint.id);
    }

    /** The tooltip of the point nearest the pointer, if close enough. */
    onPointer(event, tap = false) {
      const shared = chartDocument(this.ownerDocument).configured;
      if (
        this.#layout === null ||
        (this.#echarts !== null && !shared) ||
        (shared && event.pointerType === 'touch' && !tap)
      ) {
        return;
      }
      const point = pointerPoint(this.#parts.canvas, this.#layout, event);
      if (point === null) {
        this.hideTooltip();
      } else {
        this.showTooltip(point, event);
      }
    }

    /** Replace the SVG with ECharts once the adapter and ECharts load. */
    async useECharts(spec, canvas) {
      const svg = canvas.querySelector('svg');
      try {
        const { instance, updatePresentation } = await mountECharts(
          canvas,
          spec,
          this.#layout,
          {
            loadECharts: this.loadECharts,
            ...chartPresentation(this),
          }
        );
        if (this.#parts?.canvas !== canvas || this.#resumeECharts) {
          instance.dispose?.();
          return;
        }
        this.#updateECharts = updatePresentation;
        updatePresentation(chartPresentation(this));
        // The SVG stays as the accessible image; ECharts draws the marks.
        svg.classList.add('ui-visually-hidden');
        this.#echarts = instance;
        this.setAttribute('data-renderer', 'echarts');
      } catch (error) {
        canvas.querySelector('.ui-chart-echarts')?.remove();
        this.dispatchEvent(
          new win.CustomEvent('chart-error', { detail: error, bubbles: true })
        );
      }
    }
  };
}

/**
 * Define `<ui-chart>` in a window, unless the tag is taken.
 * @param {Window} [win]
 * @returns {CustomElementConstructor}
 */
export const defineChartElement = (win = globalThis.window) =>
  defineElement(win, CHART_TAG, createChartClass);
