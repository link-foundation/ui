/**
 * Text alternatives of a chart: a one-sentence summary, the accessible
 * name, and the data table twin that every chart element carries.
 */

import { fieldTitle, formatValue } from './scales.js';
import { formatNumber } from './values.js';

const MARK_NAMES = {
  calendar: 'Calendar heatmap',
  range: 'Range timeline',
  composition: 'Composition bar',
  line: 'Line chart',
  area: 'Area chart',
  bar: 'Bar chart',
  point: 'Scatter plot',
  arc: 'Pie chart',
};

/** `12` or `12 %` or `30,200 USD`. */
export const withUnit = (value, unit) =>
  unit === null || unit === undefined
    ? formatNumber(value)
    : `${formatNumber(value)} ${unit}`;

/** The range of a quantitative field as text. */
function rangeText(spec, def) {
  const values = spec.data.values.map((row) => Number(row[def.field]));
  const low = Math.min(...values);
  const high = Math.max(...values);
  return `${fieldTitle(def)} from ${formatValue(def, low)} to ${formatValue(def, high)}`;
}

function summarizeMarkChart(spec) {
  const { x, y, theta, color } = spec.encoding;
  const count = spec.data.values.length;
  const name =
    spec.mark.type === 'arc' && spec.mark.innerRadius > 0
      ? 'Donut chart'
      : MARK_NAMES[spec.mark.type];
  const parts = ['arc', 'composition'].includes(spec.mark.type)
    ? [
        `${name} of ${fieldTitle(theta)}${color ? ` by ${fieldTitle(color)}` : ''}`,
      ]
    : [`${name} of ${fieldTitle(y)} by ${fieldTitle(x)}`];
  if (color && spec.mark.type !== 'arc') {
    const series = new Set(
      spec.data.values.map((row) => String(row[color.field]))
    );
    parts.push(`${series.size} series by ${fieldTitle(color)}`);
  }
  parts.push(`${count} ${count === 1 ? 'value' : 'values'}`);
  const measured = [x, y, theta].find((def) => def?.type === 'quantitative');
  if (measured !== undefined && spec.mark.type !== 'arc') {
    parts.push(rangeText(spec, measured));
  }
  return `${parts.join(', ')}.`;
}

const trendWord = (delta) => {
  if (delta > 0) {
    return 'up';
  }
  return delta < 0 ? 'down' : 'unchanged';
};

/** A delta in percent as text: `up 12.5 %`. */
export const deltaText = (delta) =>
  delta === 0
    ? 'unchanged'
    : `${trendWord(delta)} ${formatNumber(Math.abs(delta))} %`;

const SMALL_SUMMARIES = {
  gauge: (spec) =>
    `${spec.label ?? 'Gauge'}: ${withUnit(spec.value, spec.unit)} of a range from ${formatNumber(spec.min)} to ${formatNumber(spec.max)}.`,
  'stat-tile': (spec) =>
    `${spec.label ?? 'Value'}: ${withUnit(spec.value, spec.unit)}${spec.delta === null ? '' : `, ${deltaText(spec.delta)}`}.`,
  sparkline: (spec) => {
    const { values } = spec;
    return `${spec.label ?? 'Trend'}: ${values.length} values from ${formatNumber(values[0])} to ${formatNumber(values.at(-1))}, lowest ${formatNumber(Math.min(...values))}, highest ${formatNumber(Math.max(...values))}.`;
  },
};

/**
 * A one-sentence summary of what a chart shows, computed from its data.
 * @param {import('./chart-model.js').ChartSpec|import('./small-model.js').SmallChartSpec} spec
 */
export function summarizeChart(spec) {
  if (spec.kind === 'tag-cloud') {
    return `${spec.label ?? 'Tags'}: ${spec.items.length} items.`;
  }
  const small = SMALL_SUMMARIES[spec.kind];
  return small === undefined ? summarizeMarkChart(spec) : small(spec);
}

/**
 * The accessible name of a chart: its description, else its title (or
 * label), else the summary. Never empty.
 */
export function chartLabel(spec) {
  if (spec.kind === 'stat-tile' && spec.notation === 'compact') {
    return `${spec.description ?? spec.label ?? 'Value'}: ${spec.value}${spec.unit ? ` ${spec.unit}` : ''}${spec.hint ? `, ${spec.hint}` : ''}`;
  }
  for (const text of [spec.description, spec.title, spec.label]) {
    if (typeof text === 'string' && text.trim() !== '') {
      return text;
    }
  }
  return summarizeChart(spec);
}

/** The columns of a mark chart: every encoded field, then the others. */
function markColumns(spec) {
  const encoded = ['x', 'x2', 'theta', 'color', 'y', 'size']
    .map((name) => spec.encoding[name])
    .concat(spec.encoding.tooltip ?? [])
    .filter(Boolean);
  const columns = [];
  const seen = new Set();
  for (const def of encoded) {
    if (!seen.has(def.field)) {
      seen.add(def.field);
      columns.push(def);
    }
  }
  return columns;
}

function markTable(spec) {
  const columns = markColumns(spec);
  return {
    columns: columns.map(fieldTitle),
    numeric: columns.map((def) => def.type === 'quantitative'),
    rows: spec.data.values.map((row) =>
      columns.map((def) =>
        row[def.field] === undefined || row[def.field] === 'ongoing'
          ? 'ongoing'
          : formatValue(def, row[def.field])
      )
    ),
  };
}

const SMALL_TABLES = {
  gauge: (spec) => ({
    columns: ['Value', 'Minimum', 'Maximum'],
    numeric: [true, true, true],
    rows: [
      [
        withUnit(spec.value, spec.unit),
        formatNumber(spec.min),
        formatNumber(spec.max),
      ],
    ],
  }),
  'stat-tile': (spec) => ({
    columns: ['Value', 'Change', ...(spec.trend.length ? ['Trend'] : [])],
    numeric: [true, false, false],
    rows: [
      [
        withUnit(spec.value, spec.unit),
        spec.delta === null ? '' : deltaText(spec.delta),
        ...(spec.trend.length
          ? [spec.trend.map((v) => formatNumber(v)).join(', ')]
          : []),
      ],
    ],
  }),
  sparkline: (spec) => ({
    columns: ['Position', spec.label ?? 'Value'],
    numeric: [true, true],
    rows: spec.values.map((value, i) => [String(i + 1), formatNumber(value)]),
  }),
};

/**
 * The data table twin of a chart: a caption, column headers and the rows
 * as people read them (dates and numbers formatted).
 * @returns {{caption: string, columns: string[], numeric: boolean[], rows: string[][]}}
 */
export function chartTable(spec) {
  if (spec.kind === 'tag-cloud') {
    return {
      caption: spec.label ?? 'Tags',
      columns: ['Tag', 'Count'],
      numeric: [false, true],
      rows: spec.items.map((item) => [item.name, String(item.count ?? 0)]),
    };
  }
  const small = SMALL_TABLES[spec.kind];
  const table = small === undefined ? markTable(spec) : small(spec);
  return { caption: spec.title ?? spec.label ?? chartLabel(spec), ...table };
}
