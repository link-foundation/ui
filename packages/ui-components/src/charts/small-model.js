/**
 * The small charts of the chart dialect: a single value with context.
 *
 * ```lino
 * (cpu: gauge (label CPU) (value 72) (min 0) (max 100) (unit %))
 * (revenue: stat-tile (label Revenue) (value 30200) (unit USD) (delta 12.5)
 *   (trend 12 18 21 25 30))
 * (visits: sparkline (label Visits) (values 3 5 2 8 6) (mark area))
 * ```
 */

import { fail } from './errors.js';
import { prop } from './lino.js';
import {
  numberList,
  optionalNumber,
  optionalText,
  properties,
} from './read.js';

/** The kinds of the small charts. */
export const SMALL_KINDS = Object.freeze(['gauge', 'stat-tile', 'sparkline']);

/** The marks a sparkline can draw. */
export const SPARKLINE_MARKS = Object.freeze(['line', 'area', 'bar']);

/**
 * @typedef {object} GaugeSpec
 * @property {'gauge'} kind
 * @property {string|null} id
 * @property {string|null} label
 * @property {string|null} description
 * @property {number} value
 * @property {number} min  default 0
 * @property {number} max  default 100
 * @property {string|null} unit
 *
 * @typedef {object} StatTileSpec
 * @property {'stat-tile'} kind
 * @property {string|null} id
 * @property {string|null} label
 * @property {string|null} description
 * @property {number} value
 * @property {string|null} unit
 * @property {number|null} delta  the change, in percent
 * @property {number[]} trend  recent values, drawn as a sparkline
 *
 * @typedef {object} SparklineSpec
 * @property {'sparkline'} kind
 * @property {string|null} id
 * @property {string|null} label
 * @property {string|null} description
 * @property {number[]} values
 * @property {'line'|'area'|'bar'} mark
 *
 * @typedef {GaugeSpec|StatTileSpec|SparklineSpec} SmallChartSpec
 */

const COMMON = ['label', 'description'];

const PROPERTIES = {
  gauge: [...COMMON, 'value', 'min', 'max', 'unit'],
  'stat-tile': [
    ...COMMON,
    'value',
    'unit',
    'delta',
    'trend',
    'notation',
    'compact-threshold',
    'hint',
    'footnote',
  ],
  sparkline: [...COMMON, 'values', 'mark'],
};

/** A required property entry, or a ChartSpecError at the chart. */
function required(props, name, node, path, kind) {
  const entry = props.get(name)?.[0];
  if (entry === undefined) {
    fail('missing-field', `a ${kind} needs (${name} ...)`, node, path);
  }
  return entry;
}

function readGauge(props, node, path) {
  required(props, 'value', node, path, 'gauge');
  const gauge = {
    value: optionalNumber(props, 'value'),
    min: optionalNumber(props, 'min', 0),
    max: optionalNumber(props, 'max', 100),
    unit: optionalText(props, 'unit'),
  };
  if (gauge.max <= gauge.min) {
    const entry = props.get('max')?.[0] ?? { node, path };
    fail('invalid-value', '(max) must be above (min)', entry.node, entry.path);
  }
  return gauge;
}

function readStatTile(props, node, path) {
  required(props, 'value', node, path, 'stat-tile');
  const trend = props.get('trend')?.[0];
  const extras = {};
  for (const name of ['notation', 'hint']) {
    if (props.has(name)) {
      extras[name] = optionalText(props, name);
    }
  }
  if (extras.notation && extras.notation !== 'compact') {
    fail('invalid-value', 'notation must be compact', node, path);
  }
  if (props.has('compact-threshold')) {
    extras.compactThreshold = optionalNumber(props, 'compact-threshold');
    if (extras.compactThreshold < 0) {
      fail(
        'invalid-value',
        'compact-threshold must be nonnegative',
        node,
        path
      );
    }
  }
  if (props.has('footnote')) {
    const entry = props.get('footnote')[0];
    const fields = properties(entry.node, entry.path, 1, ['label', 'href']);
    const href = optionalText(fields, 'href');
    if (!href || !/^(https?:|mailto:|\/|#)/u.test(href)) {
      fail(
        'invalid-value',
        'footnote requires an http, mailto or relative href',
        entry.node,
        entry.path
      );
    }
    extras.footnote = {
      label: optionalText(fields, 'label') ?? 'Source',
      href,
    };
  }
  return {
    ...extras,
    value: optionalNumber(props, 'value'),
    unit: optionalText(props, 'unit'),
    delta: optionalNumber(props, 'delta'),
    trend: trend === undefined ? [] : numberList(trend, 'trend'),
  };
}

function readSparkline(props, node, path) {
  const values = numberList(
    required(props, 'values', node, path, 'sparkline'),
    'values'
  );
  const mark = optionalText(props, 'mark') ?? 'line';
  if (!SPARKLINE_MARKS.includes(mark)) {
    const entry = props.get('mark')[0];
    fail(
      'unknown-mark',
      `unknown sparkline mark "${mark}" (expected ${SPARKLINE_MARKS.join(', ')})`,
      entry.node,
      entry.path
    );
  }
  return { values, mark };
}

const READERS = {
  gauge: readGauge,
  'stat-tile': readStatTile,
  sparkline: readSparkline,
};

/**
 * Read one small chart node (already unfolded).
 * @param {import('./lino.js').Node} node
 * @param {number[]} path
 * @param {'gauge'|'stat-tile'|'sparkline'} kind
 * @returns {SmallChartSpec}
 */
export function readSmallChart(node, path, kind) {
  const props = properties(node, path, 1, PROPERTIES[kind]);
  return {
    kind,
    id: node.id,
    label: optionalText(props, 'label'),
    description: optionalText(props, 'description'),
    ...READERS[kind](props, node, path),
  };
}

const DEFAULTS = { min: 0, max: 100, mark: 'line' };

/** Whether a property keeps its default (and is not written). */
const isDefault = (name, value) =>
  value === null ||
  value === undefined ||
  DEFAULTS[name] === value ||
  (Array.isArray(value) && value.length === 0);

/**
 * The LiNo node of a small chart spec.
 * @param {SmallChartSpec} spec
 */
export function smallChartNode(spec) {
  const values = [{ id: spec.kind, values: [] }];
  for (const name of PROPERTIES[spec.kind]) {
    const value =
      spec[name === 'compact-threshold' ? 'compactThreshold' : name];
    if (name === 'footnote' && value) {
      values.push(
        prop('footnote', prop('label', value.label), prop('href', value.href))
      );
      continue;
    }
    if (!isDefault(name, value)) {
      values.push(
        prop(name, ...(Array.isArray(value) ? value : [value]).map(String))
      );
    }
  }
  return { id: spec.id ?? null, values };
}
