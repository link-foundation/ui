/**
 * Scales of the chart dialect: each encoding channel maps its field to
 * pixels or colours through d3-scale. Temporal fields use UTC scales, so a
 * chart looks the same in every time zone.
 */

import {
  scaleBand,
  scaleLinear,
  scaleLog,
  scalePoint,
  scaleSqrt,
  scaleUtc,
} from 'd3-scale';
import { seriesToken, tokenColor } from './tokens.js';
import { formatNumber, formatTime, parseTemporal } from './values.js';

/** Whether a field is discrete (nominal or ordinal). */
export const isDiscrete = (def) =>
  def.type === 'nominal' || def.type === 'ordinal';

/** The title of a field: its `(title)` or the field name. */
export const fieldTitle = (def) => def.title ?? def.field;

/**
 * A value as people read it: a date for temporal fields, a grouped number
 * for quantitative fields, the text otherwise.
 * @param {import('./chart-model.js').FieldDef} def
 * @param {string|number} value
 */
export function formatValue(def, value) {
  if (def.type === 'temporal') {
    const time = parseTemporal(value);
    return time === null ? String(value) : formatTime(time);
  }
  if (def.type === 'quantitative' && typeof value === 'number') {
    return formatNumber(value);
  }
  return String(value);
}

/** The number a continuous scale reads from a value. */
export const continuousValue = (def, value) =>
  def.type === 'temporal' ? parseTemporal(value) : Number(value);

/**
 * The distinct values of a field, as text keys: in data order for nominal
 * and ordinal fields, ascending for temporal and quantitative ones.
 * @param {import('./chart-model.js').FieldDef} def
 * @param {readonly Record<string, string|number>[]} rows
 * @returns {string[]}
 */
export function discreteDomain(def, rows) {
  const keys = [...new Set(rows.map((row) => String(row[def.field])))];
  if (isDiscrete(def)) {
    return keys;
  }
  return keys.sort((a, b) => continuousValue(def, a) - continuousValue(def, b));
}

function logPositionScale(def, rows, range, extent) {
  const base = def.scale.base ?? 10;
  const positive = rows
    .map((row) => Number(row[def.field]))
    .concat(extent)
    .filter((value) => value > 0);
  const low = positive.length ? Math.min(...positive) : 1;
  const high = positive.length ? Math.max(...positive) : base;
  const scale = scaleLog()
    .base(base)
    .domain([low, high === low ? low * base : high])
    .range(range)
    .nice();
  const minimum = scale.domain()[0];
  const position = (value) => scale(Math.max(minimum, Number(value)));
  return {
    kind: 'continuous',
    position,
    continuous: position,
    bandwidth: 0,
    ticks: () => {
      const [a, b] = scale.domain();
      const ticks = [];
      const first = Math.ceil(Math.log(a) / Math.log(base) - 1e-10);
      const last = Math.floor(Math.log(b) / Math.log(base) + 1e-10);
      const stride = Math.max(1, Math.ceil((last - first) / 32));
      for (let power = first; power <= last; power += stride) {
        const value = base ** power;
        ticks.push({
          value,
          position: scale(value),
          label: formatNumber(value),
        });
      }
      return ticks;
    },
  };
}

/** A domain that is not a single point. */
function spread([low, high], def) {
  if (low !== high) {
    return [low, high];
  }
  const step = def.type === 'temporal' ? 86_400_000 : Math.abs(low) || 1;
  return [low - step, high + step];
}

/** A domain widened by a share of its span at both ends. */
function padded([low, high], pad) {
  const margin = (high - low) * pad;
  return [low - margin, high + margin];
}

/**
 * A position scale of a channel.
 * @param {import('./chart-model.js').FieldDef} def
 * @param {readonly Record<string, string|number>[]} rows
 * @param {[number, number]} range
 * @param {object} [options]
 * @param {boolean} [options.band]  a band per value (bars)
 * @param {boolean} [options.zero]  include zero (bars, areas)
 * @param {number[]} [options.extent]  extra values to include (stacks)
 * @param {number} [options.pad]  a share of the span added at both ends
 *   of a quantitative domain, so marks (points) clear the axes
 * @returns {PositionScale}
 *
 * @typedef {object} PositionScale
 * @property {'band'|'point'|'continuous'} kind
 * @property {(value: string|number) => number} position  the pixel centre
 * @property {number} bandwidth  the band width (0 unless `band`)
 * @property {(value: number) => number} [continuous]  the raw d3 scale
 * @property {(count: number) => {position: number, label: string, value: number|string}[]} ticks
 */
export function positionScale(def, rows, range, options = {}) {
  const { band = false, zero = false, extent = [], pad = 0 } = options;
  if (band || isDiscrete(def)) {
    const domain = discreteDomain(def, rows);
    const scale = band
      ? scaleBand(domain, range).paddingInner(0.2).paddingOuter(0.1)
      : scalePoint(domain, range).padding(0.5);
    const half = scale.bandwidth() / 2;
    const position = (value) => scale(String(value)) + half;
    return {
      kind: band ? 'band' : 'point',
      position,
      bandwidth: scale.bandwidth(),
      ticks: () =>
        domain.map((key) => ({
          value: key,
          position: position(key),
          label: formatValue(
            def,
            def.type === 'quantitative' ? Number(key) : key
          ),
        })),
    };
  }
  if (def.scale?.type === 'log') {
    return logPositionScale(def, rows, range, extent);
  }
  const values = [
    ...rows.map((row) => continuousValue(def, row[def.field])),
    ...extent,
    ...(zero ? [0] : []),
  ];
  const bounds = padded(
    spread([Math.min(...values), Math.max(...values)], def),
    def.type === 'quantitative' ? pad : 0
  );
  const scale =
    def.type === 'temporal'
      ? scaleUtc().domain(bounds).range(range)
      : scaleLinear().domain(bounds).range(range).nice();
  return {
    kind: 'continuous',
    position: (value) => scale(continuousValue(def, value)),
    continuous: (value) => scale(value),
    bandwidth: 0,
    ticks: (count) => {
      const format = scale.tickFormat(count);
      return scale.ticks(count).map((value) => ({
        value: Number(value),
        position: scale(value),
        label: format(value),
      }));
    },
  };
}

/**
 * The colour scale of the `color` channel: the series colour tokens in the
 * order of the distinct values.
 * @param {import('./chart-model.js').FieldDef|undefined} def
 * @param {readonly Record<string, string|number>[]} rows
 * @param {Record<string, string>|Map<string, string>|null} [tokens]
 */
export function colorScale(def, rows, tokens = null) {
  const domain = def === undefined ? [] : discreteDomain(def, rows);
  const colorAt = (index) => tokenColor(seriesToken(index), tokens);
  return {
    domain,
    colorAt,
    index: (value) => Math.max(0, domain.indexOf(String(value))),
    color: (value) => colorAt(Math.max(0, domain.indexOf(String(value)))),
  };
}

/**
 * The radius scale of the `size` channel: the area of a point grows with
 * the value.
 * @param {import('./chart-model.js').FieldDef|undefined} def
 * @param {readonly Record<string, string|number>[]} rows
 * @param {[number, number]} [range]  radii in pixels
 */
export function sizeScale(def, rows, range = [3, 12]) {
  if (def === undefined) {
    return () => 4.5;
  }
  const max = Math.max(...rows.map((row) => Math.abs(Number(row[def.field]))));
  const scale = scaleSqrt([0, max || 1], range);
  return (value) => scale(Math.abs(Number(value)));
}
