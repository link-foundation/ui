/**
 * The geometry of a chart: plot area, axes, legend, marks and the points a
 * keyboard user moves between. Pure and deterministic; `svg-renderer.js`
 * writes it as SVG and the `<ui-chart>` element uses its points for the
 * focus ring and the tooltip.
 */

import { ACTIVITY_LAYOUTS } from './activity-layout.js';
import { decorateSeries, roundedBar, emphasizeArcs } from './mark-options.js';
import {
  arc as d3Arc,
  area as d3Area,
  curveLinear,
  curveMonotoneX,
  curveStepAfter,
  line as d3Line,
  pie as d3Pie,
} from 'd3-shape';
import {
  colorScale,
  continuousValue,
  fieldTitle,
  formatValue,
  isDiscrete,
  positionScale,
  sizeScale,
} from './scales.js';
import { chartLabel } from './summary.js';

const CURVES = {
  linear: curveLinear,
  monotone: curveMonotoneX,
  step: curveStepAfter,
};

/** The default size of a chart, in pixels. */
export const DEFAULT_WIDTH = 640;
export const DEFAULT_HEIGHT = 360;

const CHAR_WIDTH = 7;
const TITLE_HEIGHT = 28;
const LEGEND_HEIGHT = 24;

/** A number rounded to hundredths, so the output has no float noise. */
export const round = (value) => Math.round(value * 100) / 100;

/**
 * @typedef {object} ChartPoint  a value a keyboard user can move to
 * @property {number} series  the series index
 * @property {number} index  the index of the point in its series
 * @property {number} row  the index of the data row
 * @property {number} x  the centre, in SVG pixels
 * @property {number} y
 * @property {string} text  the tooltip and announcement
 *
 * @typedef {object} ChartSeries
 * @property {string|null} key  the colour value, or null for a single series
 * @property {string} color
 * @property {ChartPoint[]} points
 * @property {object[]} shapes  the marks: `{tag, attrs}`
 *
 * @typedef {object} ChartLayout
 * @property {number} width
 * @property {number} height
 * @property {string|null} title
 * @property {string} label  the accessible name
 * @property {{x: number, y: number, width: number, height: number}} plot
 * @property {object[]} axes
 * @property {{label: string, color: string, x: number, y: number}[]} legend
 * @property {ChartSeries[]} series
 */

/** The fields of the tooltip of a chart. */
export function tooltipFields(spec) {
  const { encoding } = spec;
  if (encoding.tooltip !== undefined) {
    return encoding.tooltip;
  }
  const seen = new Set();
  return ['color', 'x', 'theta', 'y', 'size']
    .map((name) => encoding[name])
    .filter((def) => {
      if (def === undefined || seen.has(def.field)) {
        return false;
      }
      seen.add(def.field);
      return true;
    });
}

/** The tooltip text of a data row. */
export const rowText = (fields, row) =>
  fields
    .map((def) => `${fieldTitle(def)}: ${formatValue(def, row[def.field])}`)
    .join(', ');

/** The rows of each series, in colour order, keeping each row index. */
function groupSeries(spec, colors) {
  const { encoding, data } = spec;
  const rows = data.values.map((row, index) => ({ row, index }));
  if (encoding.color === undefined || spec.mark.type === 'arc') {
    return [{ key: null, items: rows }];
  }
  const field = encoding.color.field;
  return colors.domain.map((key) => ({
    key,
    items: rows.filter(({ row }) => String(row[field]) === key),
  }));
}

/** Sort the items of a series along a continuous axis. */
function sortAlong(items, def) {
  if (def === undefined || isDiscrete(def)) {
    return items;
  }
  return [...items].sort(
    (a, b) =>
      continuousValue(def, a.row[def.field]) -
      continuousValue(def, b.row[def.field])
  );
}

/** The longest tick label width estimate, for the left margin. */
const labelWidth = (ticks) =>
  Math.max(0, ...ticks.map((tick) => tick.label.length)) * CHAR_WIDTH;

/**
 * Stack the values of the series per category: each item gets the low and
 * high value of its segment. Positive and negative values stack apart.
 */
function stack(groups, keyDef, valueDef) {
  const positive = new Map();
  const negative = new Map();
  const totals = [];
  for (const group of groups) {
    for (const item of group.items) {
      const key = String(item.row[keyDef.field]);
      const value = Number(item.row[valueDef.field]);
      const totalsMap = value < 0 ? negative : positive;
      const low = totalsMap.get(key) ?? 0;
      item.low = low;
      item.high = low + value;
      totalsMap.set(key, item.high);
      totals.push(item.high);
    }
  }
  return totals;
}

/** The orientation of a bar chart: bars along the discrete axis. */
const isHorizontal = (spec) =>
  spec.mark.type === 'bar' &&
  isDiscrete(spec.encoding.y) &&
  !isDiscrete(spec.encoding.x);

/** Whether the values of a mark stack (bars and areas with colours). */
const isStacked = (spec) =>
  (spec.mark.type === 'bar' || spec.mark.type === 'area') &&
  spec.encoding.color !== undefined;

/** The scales of a Cartesian chart, sized to the plot. */
function cartesianScales(spec, groups, plot) {
  const { x, y } = spec.encoding;
  const rows = spec.data.values;
  const horizontal = isHorizontal(spec);
  const [keyDef, valueDef] = horizontal ? [y, x] : [x, y];
  const filled = spec.mark.type === 'bar' || spec.mark.type === 'area';
  let extent = [];
  if (isStacked(spec)) {
    extent = stack(groups, keyDef, valueDef);
  }
  const keyBand = spec.mark.type === 'bar';
  const pad = spec.mark.type === 'point' ? 0.05 : 0;
  const xScale = positionScale(x, rows, [0, plot.width], {
    band: keyBand && !horizontal,
    zero: filled && horizontal,
    extent: horizontal ? extent : [],
    pad,
  });
  const yScale = positionScale(y, rows, [plot.height, 0], {
    band: keyBand && horizontal,
    zero: filled && !horizontal,
    extent: horizontal ? [] : extent,
    pad,
  });
  return { xScale, yScale, horizontal, keyDef, valueDef };
}

/** The axes: ticks, grid lines and titles. */
function cartesianAxes(spec, scales, plot) {
  const xTicks = scales.xScale.ticks(Math.max(2, Math.floor(plot.width / 90)));
  const yTicks = scales.yScale.ticks(Math.max(2, Math.floor(plot.height / 50)));
  return [
    {
      orient: 'bottom',
      title: fieldTitle(spec.encoding.x),
      ticks: xTicks,
      grid: scales.xScale.kind === 'continuous' && scales.horizontal,
    },
    {
      orient: 'left',
      title: fieldTitle(spec.encoding.y),
      ticks: yTicks,
      grid: scales.yScale.kind === 'continuous' && !scales.horizontal,
    },
  ];
}

/** The plot area left after the title, legend and axes. */
function plotArea(spec, width, height, legendRows, yLabelWidth) {
  const top = (spec.title ? TITLE_HEIGHT : 8) + legendRows * LEGEND_HEIGHT + 8;
  const left = 20 + yLabelWidth + 12;
  const bottom = 46;
  const right = 20;
  return {
    x: left,
    y: top,
    width: Math.max(40, width - left - right),
    height: Math.max(40, height - top - bottom),
  };
}

/** The shapes and points of a bar series. */
function barShapes(group, scales, color, fields, spec) {
  const { xScale, yScale, horizontal, keyDef, valueDef } = scales;
  const keyScale = horizontal ? yScale : xScale;
  const valueScale = horizontal ? xScale : yScale;
  const shapes = [];
  const points = [];
  for (const item of group.items) {
    const key = item.row[keyDef.field];
    const value = Number(item.row[valueDef.field]);
    const low = item.low ?? 0;
    const high = item.high ?? value;
    const center = keyScale.position(key);
    const a = valueScale.continuous(low);
    const b = valueScale.continuous(high);
    const half = keyScale.bandwidth / 2;
    const attrs = horizontal
      ? {
          x: Math.min(a, b),
          y: center - half,
          width: Math.abs(b - a),
          height: half * 2,
        }
      : {
          x: center - half,
          y: Math.min(a, b),
          width: half * 2,
          height: Math.abs(b - a),
        };
    shapes.push(
      spec.cornerRadius
        ? roundedBar(
            attrs,
            spec.cornerRadius,
            horizontal,
            b < a,
            color,
            item.index
          )
        : { tag: 'rect', attrs: { ...attrs, fill: color }, row: item.index }
    );
    points.push({
      row: item.index,
      x: horizontal ? (a + b) / 2 : center,
      y: horizontal ? center - half : Math.min(a, b),
      text: rowText(fields, item.row),
    });
  }
  return { shapes, points };
}

/** The shapes and points of a line, area or point series. */
function seriesShapes(spec, group, scales, color, fields) {
  const { x, y } = spec.encoding;
  const { xScale, yScale } = scales;
  const mark = spec.mark;
  const items = sortAlong(group.items, x);
  const radius = sizeScale(spec.encoding.size, spec.data.values);
  const points = items.map((item) => ({
    row: item.index,
    x: xScale.position(item.row[x.field]),
    y:
      item.high === undefined
        ? yScale.position(item.row[y.field])
        : yScale.continuous(item.high),
    low: item.low === undefined ? null : yScale.continuous(item.low),
    radius: spec.encoding.size
      ? radius(item.row[spec.encoding.size.field])
      : 3.5,
    text: rowText(fields, item.row),
  }));
  const shapes = [];
  const curve = CURVES[mark.interpolate] ?? curveLinear;
  if (mark.type === 'area') {
    const baseline = yScale.continuous(0);
    const path = d3Area()
      .x((p) => p.x)
      .y0((p) => p.low ?? baseline)
      .y1((p) => p.y)
      .curve(curve)
      .digits(2);
    shapes.push({
      tag: 'path',
      attrs: {
        d: path(points),
        fill: color,
        'fill-opacity': 0.35,
      },
    });
  }
  if (mark.type === 'line' || mark.type === 'area') {
    const path = d3Line()
      .x((p) => p.x)
      .y((p) => p.y)
      .curve(curve)
      .digits(2);
    shapes.push({
      tag: 'path',
      attrs: {
        d: path(points),
        fill: 'none',
        stroke: color,
        'stroke-width': 2,
      },
    });
  }
  if (mark.type === 'point' || mark.point) {
    for (const p of points) {
      shapes.push({
        tag: 'circle',
        attrs: {
          cx: p.x,
          cy: p.y,
          r: p.radius,
          fill: color,
          'fill-opacity': mark.type === 'point' ? 0.75 : 1,
          stroke: mark.type === 'point' ? color : 'none',
        },
        row: p.row,
      });
    }
  }
  return {
    shapes,
    points: points.map(({ row, x: px, y: py, text }) => ({
      row,
      x: px,
      y: py,
      text,
    })),
  };
}

/** The legend entries of a colour scale, in rows across the top. */
function topLegend(colors, spec, width) {
  const entries = [];
  let x = 20;
  let row = 0;
  const top = spec.title ? TITLE_HEIGHT : 8;
  colors.domain.forEach((label, i) => {
    const entryWidth = 24 + label.length * CHAR_WIDTH + 16;
    if (x + entryWidth > width - 20 && x > 20) {
      x = 20;
      row += 1;
    }
    entries.push({
      label,
      color: colors.colorAt(i),
      x,
      y: top + row * LEGEND_HEIGHT + 12,
    });
    x += entryWidth;
  });
  return { entries, rows: colors.domain.length === 0 ? 0 : row + 1 };
}

/** The layout of a Cartesian chart (line, area, bar, point). */
function cartesianLayout(spec, width, height, tokens) {
  const rows = spec.data.values;
  const colors = colorScale(spec.encoding.color, rows, tokens);
  const legend = topLegend(colors, spec, width);
  const groups = groupSeries(spec, colors);
  const fields = tooltipFields(spec);
  // Size the left margin with the y labels of a first pass.
  const draft = plotArea(spec, width, height, legend.rows, 0);
  const draftScales = cartesianScales(spec, groupSeries(spec, colors), draft);
  const yLabels = labelWidth(cartesianAxes(spec, draftScales, draft)[1].ticks);
  const plot = plotArea(spec, width, height, legend.rows, yLabels);
  const scales = cartesianScales(spec, groups, plot);
  const series = groups.map((group, i) => {
    const color = group.key === null ? colors.colorAt(0) : colors.colorAt(i);
    const { shapes, points } =
      spec.mark.type === 'bar'
        ? barShapes(group, scales, color, fields, spec)
        : seriesShapes(spec, group, scales, color, fields);
    decorateSeries(spec, shapes, points);
    return { key: group.key, color, shapes, points };
  });
  return {
    plot,
    axes: cartesianAxes(spec, scales, plot),
    legend: legend.entries,
    series,
  };
}

/** The layout of an arc (pie or donut) chart, legend on the right. */
function arcLayout(spec, width, height, tokens) {
  const rows = spec.data.values;
  const { theta, color } = spec.encoding;
  const colors = colorScale(color, rows, tokens);
  const fields = tooltipFields(spec);
  const top = (spec.title ? TITLE_HEIGHT : 8) + 8;
  const labels = rows.map((row, i) =>
    color ? String(row[color.field]) : String(i + 1)
  );
  const legendWidth =
    40 + Math.max(...labels.map((l) => l.length)) * CHAR_WIDTH;
  const plot = {
    x: 20,
    y: top,
    width: Math.max(40, width - 40 - legendWidth),
    height: Math.max(40, height - top - 16),
  };
  const radius = Math.min(plot.width, plot.height) / 2;
  const inner = Math.min(spec.mark.innerRadius, radius - 8);
  const cx = plot.width / 2;
  const cy = plot.height / 2;
  const arcs = d3Pie()
    .value((row) => Math.max(0, Number(row[theta.field])))
    .sort(null)(rows);
  const path = d3Arc()
    .innerRadius(Math.max(0, inner))
    .outerRadius(radius)
    .digits(2);
  const colorOf = (row, i) =>
    color ? colors.color(row[color.field]) : colors.colorAt(i);
  const shapes = arcs.map((slice, i) => ({
    tag: 'path',
    attrs: {
      d: path(slice),
      transform: `translate(${round(cx)},${round(cy)})`,
      fill: colorOf(slice.data, i),
      stroke: 'var(--color-chart-background, #ffffff)',
      'stroke-width': 1,
    },
    row: i,
  }));
  const points = arcs.map((slice, i) => {
    const [px, py] = path.centroid(slice);
    return {
      row: i,
      x: cx + px,
      y: cy + py,
      text: rowText(fields, slice.data),
    };
  });
  emphasizeArcs(spec, shapes, points);
  const seen = new Set();
  const legend = [];
  labels.forEach((label, i) => {
    if (!seen.has(label)) {
      seen.add(label);
      legend.push({
        label,
        color: colorOf(rows[i], i),
        x: plot.x + plot.width + 20,
        y: top + 12 + legend.length * LEGEND_HEIGHT,
      });
    }
  });
  return {
    plot,
    axes: [],
    legend,
    series: [{ key: null, color: colors.colorAt(0), shapes, points }],
  };
}

/**
 * The layout of a chart spec.
 * @param {import('./chart-model.js').ChartSpec} spec
 * @param {object} [options]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @param {Record<string, string>|Map<string, string>|null} [options.tokens]
 * @returns {ChartLayout}
 */
export function layoutChart(spec, options = {}) {
  const width = options.width ?? spec.width ?? DEFAULT_WIDTH;
  const height = options.height ?? spec.height ?? DEFAULT_HEIGHT;
  const tokens = options.tokens ?? null;
  const body = ACTIVITY_LAYOUTS[spec.mark.type]
    ? ACTIVITY_LAYOUTS[spec.mark.type](spec, width, height, tokens)
    : spec.mark.type === 'arc'
      ? arcLayout(spec, width, height, tokens)
      : cartesianLayout(spec, width, height, tokens);
  const series = body.series.map((item, s) => ({
    ...item,
    points: item.points.map((p, index) => ({
      ...p,
      datum: p.datum ?? spec.data.values[p.row],
      series: s,
      index,
      row: p.row,
      x: round(body.plot.x + p.x),
      y: round(body.plot.y + p.y),
      text: p.text,
    })),
  }));
  return {
    width: body.width ?? width,
    height: body.height ?? height,
    weeks: body.weeks,
    accessibleMarks: ['calendar', 'range'].includes(spec.mark.type),
    diagnostics: Object.entries(spec.encoding).flatMap(([channel, def]) =>
      def.scale?.type === 'log'
        ? spec.data.values.flatMap((row, index) =>
            Number(row[def.field]) <= 0
              ? [
                  {
                    code: 'log-clamped',
                    channel,
                    row: index,
                    value: row[def.field],
                    message: `${def.field}: nonpositive value ${row[def.field]} clamped to the positive log domain`,
                  },
                ]
              : []
          )
        : []
    ),
    title: spec.title,
    label: chartLabel(spec),
    plot: body.plot,
    axes: body.axes,
    legend: body.legend,
    series,
  };
}
