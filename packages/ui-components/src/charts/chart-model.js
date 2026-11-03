/**
 * The chart dialect: a chart written in Links Notation with the grammar of
 * Vega-Lite (data, mark, encoding), read into a normalised spec and written
 * back. Pure: no DOM, no clock, no randomness.
 *
 * ```lino
 * (sales: chart
 *   (title 'Monthly sales')
 *   (description 'Sales grew from 12 to 30 between January and June')
 *   (data
 *     (row (month 2026-01) (value 12))
 *     (row (month 2026-02) (value 18)))
 *   (mark line)
 *   (encoding
 *     (x (field month) (type temporal))
 *     (y (field value) (type quantitative))))
 * ```
 *
 * The small charts `gauge`, `stat-tile` and `sparkline` are read by
 * `small-model.js`; `chartFromLinks` accepts every kind.
 */

import { ChartSpecError, at, fail } from './errors.js';
import {
  formatNested,
  headName,
  isAtom,
  parseLino,
  prop,
  unfoldLinks,
} from './lino.js';
import {
  booleanOf,
  numberOf,
  optionalText,
  properties,
  single,
} from './read.js';
import { SMALL_KINDS, readSmallChart, smallChartNode } from './small-model.js';
import { isCanonicalNumber, parseTemporal, toNumber } from './values.js';

export { ChartSpecError };

/** The marks of the chart dialect (Vega-Lite mark types). */
export const MARKS = Object.freeze(['line', 'area', 'bar', 'point', 'arc']);

/** The field types (Vega-Lite measurement types). */
export const FIELD_TYPES = Object.freeze([
  'quantitative',
  'temporal',
  'ordinal',
  'nominal',
]);

/** The encoding channels. `theta` is the Vega-Lite angle of an `arc`. */
export const CHANNELS = Object.freeze([
  'x',
  'y',
  'theta',
  'color',
  'size',
  'tooltip',
]);

/** The renderers: our SVG renderer, or the optional ECharts adapter. */
export const RENDERERS = Object.freeze(['svg', 'echarts']);

/** Every kind `chartFromLinks` reads. */
export const CHART_KINDS = Object.freeze(['chart', ...SMALL_KINDS]);

const INTERPOLATIONS = ['linear', 'monotone', 'step'];

/** The channels each mark needs and allows. */
const MARK_CHANNELS = {
  line: { required: ['x', 'y'], allowed: ['x', 'y', 'color', 'tooltip'] },
  area: { required: ['x', 'y'], allowed: ['x', 'y', 'color', 'tooltip'] },
  bar: { required: ['x', 'y'], allowed: ['x', 'y', 'color', 'tooltip'] },
  point: {
    required: ['x', 'y'],
    allowed: ['x', 'y', 'color', 'size', 'tooltip'],
  },
  arc: { required: ['theta'], allowed: ['theta', 'color', 'tooltip'] },
};

/**
 * @typedef {'quantitative'|'temporal'|'ordinal'|'nominal'} FieldType
 *
 * @typedef {object} FieldDef
 * @property {string} field  the data field
 * @property {FieldType} type
 * @property {string|null} title  the axis or legend title (default: field)
 *
 * @typedef {object} MarkDef
 * @property {'line'|'area'|'bar'|'point'|'arc'} type
 * @property {'linear'|'monotone'|'step'} interpolate  line and area curve
 * @property {boolean} point  draw a point on every value of a line or area
 * @property {number} innerRadius  the hole of an arc (a donut), in pixels
 *
 * @typedef {object} Encoding
 * @property {FieldDef} [x]
 * @property {FieldDef} [y]
 * @property {FieldDef} [theta]
 * @property {FieldDef} [color]
 * @property {FieldDef} [size]
 * @property {FieldDef[]} [tooltip]
 *
 * @typedef {object} ChartSpec
 * @property {'chart'} kind
 * @property {string|null} id
 * @property {string|null} title
 * @property {string|null} description
 * @property {'svg'|'echarts'} renderer
 * @property {number|null} width
 * @property {number|null} height
 * @property {MarkDef} mark
 * @property {{ values: Record<string, string|number>[] }} data  typed rows
 * @property {Encoding} encoding
 */

/** The mark of `(mark line)` or `(mark line (interpolate monotone))`. */
function readMark(entry) {
  const { node, path } = entry;
  const [, type] = node.values;
  if (type === undefined || !isAtom(type)) {
    fail('missing-mark', '(mark) needs a mark type', node, path);
  }
  if (!MARKS.includes(type.id)) {
    fail(
      'unknown-mark',
      `unknown mark "${type.id}" (expected ${MARKS.join(', ')})`,
      node,
      path
    );
  }
  const mark = {
    type: type.id,
    interpolate: 'linear',
    point: false,
    innerRadius: 0,
  };
  const props = properties(node, path, 2, [
    'interpolate',
    'point',
    'inner-radius',
  ]);
  const interpolate = props.get('interpolate')?.[0];
  if (interpolate !== undefined) {
    mark.interpolate = single(
      interpolate.node,
      interpolate.path,
      'interpolate'
    );
    if (!INTERPOLATIONS.includes(mark.interpolate)) {
      fail(
        'invalid-value',
        `unknown interpolation "${mark.interpolate}"`,
        interpolate.node,
        interpolate.path
      );
    }
  }
  const point = props.get('point')?.[0];
  if (point !== undefined) {
    mark.point = booleanOf(point.node, point.path, 'point');
  }
  const inner = props.get('inner-radius')?.[0];
  if (inner !== undefined) {
    mark.innerRadius = numberOf(inner.node, inner.path, 'inner-radius');
  }
  return mark;
}

/** One `(row (field value) ...)` of the data, as raw texts. */
function readRow(node, path) {
  if (headName(node) !== 'row') {
    fail('invalid-data', 'expected (row (field value) ...)', node, path);
  }
  const row = {};
  const where = {};
  node.values.slice(1).forEach((cell, i) => {
    const cellPath = [...path, i + 1];
    const name = headName(cell);
    if (name === null) {
      fail('invalid-data', 'expected (field value)', cell, cellPath);
    }
    if (Object.hasOwn(row, name)) {
      fail(
        'duplicate-property',
        `field "${name}" is given twice`,
        cell,
        cellPath
      );
    }
    row[name] = single(cell, cellPath, name);
    where[name] = { node: cell, path: cellPath };
  });
  return { row, where };
}

/** The rows of `(data (row ...) ...)` with the position of every cell. */
function readData(entry) {
  const rows = entry.node.values
    .slice(1)
    .map((row, i) => readRow(row, [...entry.path, i + 1]));
  if (rows.length === 0) {
    fail(
      'empty-data',
      '(data) needs at least one (row ...)',
      entry.node,
      entry.path
    );
  }
  return rows;
}

/** A field definition `((field f) (type t) (title 'T'))` after its head. */
function readFieldDef(node, path, from, name) {
  const props = properties(node, path, from, ['field', 'type', 'title']);
  const field = optionalText(props, 'field');
  if (field === null) {
    fail('missing-field', `(${name}) needs (field NAME)`, node, path);
  }
  const type = optionalText(props, 'type');
  if (type !== null && !FIELD_TYPES.includes(type)) {
    const entry = props.get('type')[0];
    fail(
      'unknown-type',
      `unknown type "${type}" (expected ${FIELD_TYPES.join(', ')})`,
      entry.node,
      entry.path
    );
  }
  return {
    def: { field, type, title: optionalText(props, 'title') },
    where: { node, path, field: props.get('field')[0] },
  };
}

/**
 * The tooltip: `(tooltip (field f) (type t))` for one field, or
 * `(tooltip ((field a) (type t)) ((field b)))` for several.
 */
function readTooltip(node, path) {
  const [, first] = node.values;
  if (first !== undefined && headName(first) === null && !isAtom(first)) {
    return node.values.slice(1).map((item, i) => {
      const where = [...path, i + 1];
      return readFieldDef(item, where, 0, 'tooltip');
    });
  }
  return [readFieldDef(node, path, 1, 'tooltip')];
}

/** The channels of `(encoding (x ...) (y ...) ...)`. */
function readEncoding(entry) {
  const props = properties(entry.node, entry.path, 1, CHANNELS);
  const channels = {};
  for (const [name, [{ node, path }]] of props) {
    channels[name] =
      name === 'tooltip'
        ? readTooltip(node, path)
        : readFieldDef(node, path, 1, name);
  }
  return channels;
}

/** Whether every value of a field is a canonical number. */
const allNumbers = (rows, field) =>
  rows.every(({ row }) => isCanonicalNumber(row[field]));

/**
 * Check each encoded field against the data and give it its type: a
 * missing field is an error, and a field without `(type)` is
 * `quantitative` when every value is a number, `nominal` otherwise.
 */
function typeFields(channels, rows) {
  const types = new Map();
  for (const item of Object.values(channels).flat()) {
    const { def, where } = item;
    const missing = rows.find(({ row }) => !Object.hasOwn(row, def.field));
    if (missing !== undefined) {
      fail(
        'missing-field',
        `field "${def.field}" is missing from a data row`,
        where.field.node,
        where.field.path
      );
    }
    def.type ??= allNumbers(rows, def.field) ? 'quantitative' : 'nominal';
    const known = types.get(def.field);
    // A field has one type: the strongest one asked for wins.
    if (known === undefined || def.type === 'quantitative') {
      types.set(def.field, def.type);
    }
  }
  return types;
}

/** A typed cell, or a ChartSpecError at that cell. */
function typedValue(text, type, cell) {
  if (type === 'quantitative') {
    const number = toNumber(text);
    if (number === null) {
      fail('invalid-value', `"${text}" is not a number`, cell.node, cell.path);
    }
    return number;
  }
  if (type === 'temporal' && parseTemporal(text) === null) {
    fail('invalid-value', `"${text}" is not a date`, cell.node, cell.path);
  }
  if (type === undefined) {
    return isCanonicalNumber(text) ? Number(text) : text;
  }
  return text;
}

/** The typed rows: numbers for quantitative fields, text otherwise. */
function typeRows(rows, types) {
  return rows.map(({ row, where }) => {
    const typed = {};
    for (const [name, text] of Object.entries(row)) {
      typed[name] = typedValue(text, types.get(name), where[name]);
    }
    return typed;
  });
}

/** Check the channels a mark needs and allows. */
function checkChannels(mark, channels, markEntry, encodingEntry) {
  const { required, allowed } = MARK_CHANNELS[mark.type];
  for (const name of Object.keys(channels)) {
    if (!allowed.includes(name)) {
      const { where } = [channels[name]].flat()[0];
      fail(
        'unknown-channel',
        `a ${mark.type} mark has no "${name}" channel`,
        where.node,
        where.path
      );
    }
  }
  for (const name of required) {
    if (channels[name] === undefined) {
      const entry = encodingEntry ?? markEntry;
      fail(
        'missing-channel',
        `a ${mark.type} mark needs the "${name}" channel`,
        entry.node,
        entry.path
      );
    }
  }
}

/** The normalised encoding: field definitions in channel order. */
function encodingOf(channels) {
  const encoding = {};
  for (const name of CHANNELS) {
    const value = channels[name];
    if (value !== undefined) {
      encoding[name] = Array.isArray(value)
        ? value.map((item) => item.def)
        : value.def;
    }
  }
  return encoding;
}

/** A positive pixel size property. */
function sizeOf(props, name) {
  const entry = props.get(name)?.[0];
  if (entry === undefined) {
    return null;
  }
  const value = numberOf(entry.node, entry.path, name);
  if (value <= 0) {
    fail('invalid-value', `(${name}) must be positive`, entry.node, entry.path);
  }
  return value;
}

const CHART_PROPERTIES = [
  'title',
  'description',
  'data',
  'mark',
  'encoding',
  'renderer',
  'width',
  'height',
];

/** Read one `chart` node (already unfolded). */
function readChart(node, path) {
  const props = properties(node, path, 1, CHART_PROPERTIES);
  const markEntry = props.get('mark')?.[0];
  if (markEntry === undefined) {
    fail('missing-mark', 'a chart needs (mark TYPE)', node, path);
  }
  const mark = readMark(markEntry);
  const dataEntry = props.get('data')?.[0];
  if (dataEntry === undefined) {
    fail('empty-data', 'a chart needs (data (row ...) ...)', node, path);
  }
  const rows = readData(dataEntry);
  const encodingEntry = props.get('encoding')?.[0];
  const channels = encodingEntry ? readEncoding(encodingEntry) : {};
  checkChannels(mark, channels, markEntry, encodingEntry);
  const types = typeFields(channels, rows);
  const renderer = optionalText(props, 'renderer') ?? 'svg';
  if (!RENDERERS.includes(renderer)) {
    const entry = props.get('renderer')[0];
    fail(
      'invalid-value',
      `unknown renderer "${renderer}"`,
      entry.node,
      entry.path
    );
  }
  return {
    kind: 'chart',
    id: node.id,
    title: optionalText(props, 'title'),
    description: optionalText(props, 'description'),
    renderer,
    width: sizeOf(props, 'width'),
    height: sizeOf(props, 'height'),
    mark,
    data: { values: typeRows(rows, types) },
    encoding: encodingOf(channels),
  };
}

/** The kind of a top-level node (`chart`, `gauge`, ...), or `null`. */
function kindOf(node) {
  const [first] = node.values;
  return first !== undefined && isAtom(first) && CHART_KINDS.includes(first.id)
    ? first.id
    : null;
}

/**
 * Every chart of a list of links (a document may hold other elements).
 * @param {readonly import('links-notation').Link[]} links
 * @returns {(ChartSpec|import('./small-model.js').SmallChartSpec)[]}
 * @throws {ChartSpecError} with the position of the bad link
 */
export function chartsFromLinks(links) {
  if (!Array.isArray(links)) {
    throw new ChartSpecError(
      'not-a-chart',
      'expected an array of links',
      at([])
    );
  }
  return unfoldLinks(links).flatMap((node, i) => {
    const kind = kindOf(node);
    if (kind === null) {
      return [];
    }
    return [
      kind === 'chart' ? readChart(node, [i]) : readSmallChart(node, [i], kind),
    ];
  });
}

/**
 * The first chart of a list of links, as a normalised spec with resolved
 * data and encodings.
 * @param {readonly import('links-notation').Link[]} links
 * @returns {ChartSpec|import('./small-model.js').SmallChartSpec}
 * @throws {ChartSpecError} with the position of the bad link
 */
export function chartFromLinks(links) {
  const [chart] = chartsFromLinks(links);
  if (chart === undefined) {
    throw new ChartSpecError(
      'not-a-chart',
      `no (NAME: chart ...) link (expected one of ${CHART_KINDS.join(', ')})`,
      at([0])
    );
  }
  return chart;
}

/**
 * Parse LiNo text with the official parser and read its first chart.
 * @param {string} text
 */
export const parseChart = (text) => chartFromLinks(parseLino(text));

/** The LiNo node of a field definition (after its head). */
function fieldNodes(def) {
  return [
    prop('field', def.field),
    prop('type', def.type),
    ...(def.title === null || def.title === undefined
      ? []
      : [prop('title', def.title)]),
  ];
}

/** The `(mark ...)` node of a mark definition. */
function markNode(mark) {
  const options = [];
  if (mark.interpolate !== undefined && mark.interpolate !== 'linear') {
    options.push(prop('interpolate', mark.interpolate));
  }
  if (mark.point === true) {
    options.push(prop('point', 'true'));
  }
  if (mark.innerRadius) {
    options.push(prop('inner-radius', String(mark.innerRadius)));
  }
  return prop('mark', mark.type, ...options);
}

/** The `(encoding ...)` node. */
function encodingNode(encoding) {
  const channels = CHANNELS.filter((name) => encoding[name] !== undefined).map(
    (name) => {
      const value = encoding[name];
      if (name !== 'tooltip') {
        return prop(name, ...fieldNodes(value));
      }
      return value.length === 1
        ? prop('tooltip', ...fieldNodes(value[0]))
        : prop(
            'tooltip',
            ...value.map((def) => ({ id: null, values: fieldNodes(def) }))
          );
    }
  );
  return prop('encoding', ...channels);
}

/** The node of a chart spec. */
function chartNode(spec) {
  const values = [{ id: 'chart', values: [] }];
  for (const name of ['title', 'description']) {
    if (spec[name] !== null && spec[name] !== undefined) {
      values.push(prop(name, spec[name]));
    }
  }
  if (spec.renderer !== undefined && spec.renderer !== 'svg') {
    values.push(prop('renderer', spec.renderer));
  }
  for (const name of ['width', 'height']) {
    if (spec[name] !== null && spec[name] !== undefined) {
      values.push(prop(name, String(spec[name])));
    }
  }
  values.push(
    prop(
      'data',
      ...spec.data.values.map((row) =>
        prop(
          'row',
          ...Object.entries(row).map(([name, value]) =>
            prop(name, String(value))
          )
        )
      )
    ),
    markNode(typeof spec.mark === 'string' ? { type: spec.mark } : spec.mark),
    encodingNode(spec.encoding ?? {})
  );
  return { id: spec.id ?? null, values };
}

/**
 * Write a spec (of any kind) as LiNo text, in the nested form.
 * @param {ChartSpec|import('./small-model.js').SmallChartSpec} spec
 * @returns {string} LiNo text
 */
export function chartToLino(spec) {
  const node =
    spec.kind === undefined || spec.kind === 'chart'
      ? chartNode(spec)
      : smallChartNode(spec);
  return formatNested(node);
}
