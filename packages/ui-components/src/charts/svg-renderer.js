/**
 * `renderChartSvg(spec, { width, height, tokens })`: a chart spec as a
 * standalone SVG string. Deterministic: the same spec and options give the
 * same bytes on every run and machine (no ids, no clock, no randomness,
 * numbers rounded to hundredths).
 *
 * Colours are `var(--color-chart-N, #light)` so a page theme (and dark
 * mode) restyles the chart; pass `tokens` (token path to colour) to write
 * literal colours instead, for an SVG used outside a page.
 */

import { patternShapes } from './activity-layout.js';
import { tagCloudSvg } from './tag-cloud.js';
import { layoutChart } from './layout.js';
import { renderSmallChartSvg } from './small-svg.js';
import { el, escapeXml, paint, svgRoot, text } from './svg.js';
import { tokenColor } from './tokens.js';

const MARK_ATTRS = {
  fill: 'fill',
  stroke: 'stroke',
};

/** A mark shape with its colours as styles. */
function shapeSvg(shape, series) {
  const attrs = {};
  const styles = [];
  for (const [name, value] of Object.entries(shape.attrs)) {
    if (MARK_ATTRS[name] && value !== 'none') {
      styles.push(paint(name, value));
    } else {
      attrs[name] = value;
    }
  }
  return el(
    shape.tag,
    {
      ...attrs,
      style: styles.join(';') || null,
      'data-series': series,
      'data-row': shape.row,
      'data-pattern': shape.pattern,
    },
    [
      shape.title ? el('title', {}, escapeXml(shape.title)) : '',
      shape.content ? escapeXml(shape.content) : '',
    ]
  );
}

function axisSvg(axis, plot, colors) {
  const bottom = axis.orient === 'bottom';
  const ticks = axis.ticks.map((tick) => {
    const line = bottom
      ? {
          x1: tick.position,
          x2: tick.position,
          y1: plot.height,
          y2: plot.height + 5,
        }
      : { x1: -5, x2: 0, y1: tick.position, y2: tick.position };
    const label = bottom
      ? { x: tick.position, y: plot.height + 18, 'text-anchor': 'middle' }
      : { x: -8, y: tick.position + 4, 'text-anchor': 'end' };
    const grid = axis.grid
      ? el('line', {
          ...(bottom
            ? { x1: tick.position, x2: tick.position, y1: 0, y2: plot.height }
            : { x1: 0, x2: plot.width, y1: tick.position, y2: tick.position }),
          style: paint('stroke', colors.grid),
        })
      : '';
    return [
      grid,
      el('line', { ...line, style: paint('stroke', colors.axis) }),
      text(
        { ...label, 'font-size': 11, style: paint('fill', colors.muted) },
        tick.label
      ),
    ].join('');
  });
  const domain = bottom
    ? { x1: 0, x2: plot.width, y1: plot.height, y2: plot.height }
    : { x1: 0, x2: 0, y1: 0, y2: plot.height };
  const title = bottom
    ? { x: plot.width / 2, y: plot.height + 36, 'text-anchor': 'middle' }
    : {
        x: 0,
        y: 0,
        transform: `translate(${-plot.x + 14},${plot.height / 2}) rotate(-90)`,
        'text-anchor': 'middle',
      };
  return el(
    'g',
    {
      class: `ui-chart-axis ui-chart-axis-${bottom ? 'x' : 'y'}`,
      'aria-hidden': 'true',
    },
    [
      ...ticks,
      el('line', { ...domain, style: paint('stroke', colors.axis) }),
      text(
        { ...title, 'font-size': 12, style: paint('fill', colors.text) },
        axis.title
      ),
    ]
  );
}

function legendSvg(legend, colors) {
  if (legend.length === 0) {
    return '';
  }
  const items = legend.map((entry) =>
    el('g', { transform: `translate(${entry.x},${entry.y})` }, [
      el('rect', {
        x: 0,
        y: -9,
        width: 14,
        height: 14,
        rx: 2,
        style: paint('fill', entry.color),
      }),
      ...patternShapes(
        { x: 0, y: -9, width: 14, height: 14 },
        entry.pattern
      ).map((shape) => shapeSvg(shape, null)),
      text(
        { x: 20, y: 3, 'font-size': 12, style: paint('fill', colors.text) },
        entry.label
      ),
    ])
  );
  return el('g', { class: 'ui-chart-legend', 'aria-hidden': 'true' }, items);
}

/** The chart colours of the text, axes and grid. */
export const chromeColors = (tokens) => ({
  text: tokenColor('color.chart.text', tokens),
  muted: tokenColor('color.chart.muted', tokens),
  axis: tokenColor('color.chart.axis', tokens),
  grid: tokenColor('color.chart.grid', tokens),
});

/**
 * Write a laid out chart as SVG.
 * @param {import('./layout.js').ChartLayout} layout
 * @param {object} [options]
 * @param {Record<string, string>|Map<string, string>|null} [options.tokens]
 */
export function layoutToSvg(layout, options = {}) {
  const colors = chromeColors(options.tokens ?? null);
  const { plot } = layout;
  const children = [];
  if (layout.title) {
    children.push(
      text(
        {
          class: 'ui-chart-title',
          x: 20,
          y: 20,
          'font-size': 15,
          'font-weight': 600,
          style: paint('fill', colors.text),
        },
        layout.title
      )
    );
  }
  children.push(legendSvg(layout.legend, colors));
  const marks = layout.series.map((series, s) =>
    el(
      'g',
      { class: 'ui-chart-series', 'data-series': s, 'data-key': series.key },
      series.shapes.map((shape) => shapeSvg(shape, s))
    )
  );
  children.push(
    el(
      'g',
      { class: 'ui-chart-plot', transform: `translate(${plot.x},${plot.y})` },
      [
        ...layout.axes.map((axis) => axisSvg(axis, plot, colors)),
        el(
          'g',
          {
            class: 'ui-chart-marks',
            'aria-hidden': layout.accessibleMarks ? null : 'true',
          },
          marks
        ),
      ]
    )
  );
  return svgRoot(
    {
      width: layout.width,
      height: layout.height,
      label: layout.label,
      title: layout.title,
      className: 'ui-chart-svg',
      role: layout.accessibleMarks ? 'group' : 'img',
    },
    children
  );
}

/**
 * A chart spec (any kind) as an SVG string.
 * @param {import('./chart-model.js').ChartSpec|import('./small-model.js').SmallChartSpec} spec
 * @param {object} [options]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @param {Record<string, string>|Map<string, string>|null} [options.tokens]
 *   token path (`color.chart.1`) to colour; default: CSS custom properties
 * @returns {string}
 */
export function renderChartSvg(spec, options = {}) {
  if (spec.kind === 'tag-cloud') {
    return tagCloudSvg(spec);
  }
  if (spec.kind !== undefined && spec.kind !== 'chart') {
    return renderSmallChartSvg(spec, options);
  }
  return layoutToSvg(layoutChart(spec, options), options);
}
