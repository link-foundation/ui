/**
 * The chart dialect: LiNo links to a normalised spec and back, and the
 * ChartSpecError with the position of the bad link.
 */

import { describe, it, expect } from 'test-anywhere';
import { parseNested } from '@link-foundation/ui-core';
import {
  ChartSpecError,
  chartFromLinks,
  chartsFromLinks,
  chartToLino,
  parseChart,
} from '../../src/charts/chart-model.js';
import { chartFixtures, fixture, thrown } from './helpers.js';

// The readers' own parse: indented lines are values of the line above.
const parse = (text) => parseNested(text);

describe('chartFromLinks / chartToLino', () => {
  it('round-trips every fixture through the official parser', () => {
    const files = chartFixtures();
    expect(files.length).toBeGreaterThanOrEqual(6);
    let count = 0;
    for (const file of files) {
      for (const spec of chartsFromLinks(parse(fixture(file)))) {
        expect(chartFromLinks(parse(chartToLino(spec)))).toEqual(spec);
        count += 1;
      }
    }
    // five marks and the three small charts
    expect(count).toBe(8);
  });

  it('reads the sales chart into the normalised spec', () => {
    const spec = chartFromLinks(parse(fixture('sales-line.lino')));
    expect(spec.kind).toBe('chart');
    expect(spec.id).toBe('sales');
    expect(spec.title).toBe('Monthly sales');
    expect(spec.mark).toEqual({
      type: 'line',
      interpolate: 'linear',
      point: true,
      innerRadius: 0,
    });
    expect(spec.data.values[0]).toEqual({ month: '2026-01', value: 12 });
    expect(spec.encoding.x).toEqual({
      field: 'month',
      type: 'temporal',
      title: 'Month',
    });
    expect(spec.encoding.y.type).toBe('quantitative');
  });

  it('gives the same spec for the one-line, multi-line and indented forms', () => {
    const oneLine =
      "(s: chart (title 'T x') (data (row (a x) (b 1)) (row (a y) (b 2))) (mark bar) (encoding (x (field a)) (y (field b))))";
    const multiLine = `(s: chart
  (title 'T x')
  (data (row (a x) (b 1)) (row (a y) (b 2)))
  (mark bar)
  (encoding (x (field a)) (y (field b))))`;
    const indented = `s: chart
  (title 'T x')
  (data (row (a x) (b 1)) (row (a y) (b 2)))
  (mark bar)
  (encoding (x (field a)) (y (field b)))`;
    const spec = parseChart(oneLine);
    expect(parseChart(multiLine)).toEqual(spec);
    expect(parseChart(indented)).toEqual(spec);
  });

  it('infers missing field types from the data', () => {
    const spec = parseChart(
      '(c: chart (data (row (a x) (b 1))) (mark point) (encoding (x (field a)) (y (field b))))'
    );
    expect(spec.encoding.x.type).toBe('nominal');
    expect(spec.encoding.y.type).toBe('quantitative');
    expect(chartToLino(spec)).toContain('(type nominal)');
  });

  it('keeps the other charts of a document and skips other links', () => {
    const links = parse(`(button (text Hi))\n${fixture('small-charts.lino')}`);
    expect(chartsFromLinks(links).map((s) => s.kind)).toEqual([
      'gauge',
      'stat-tile',
      'sparkline',
    ]);
    expect(chartFromLinks(links).kind).toBe('gauge');
  });

  it('reads the small charts with their defaults', () => {
    const [gauge, tile, line] = chartsFromLinks(
      parse(fixture('small-charts.lino'))
    );
    expect(gauge).toEqual({
      kind: 'gauge',
      id: 'cpu',
      label: 'CPU',
      description: 'CPU load is 72 percent',
      value: 72,
      min: 0,
      max: 100,
      unit: '%',
    });
    expect(tile.trend).toEqual([12, 18, 15, 21, 25, 30]);
    expect(tile.delta).toBe(12.5);
    expect(line.mark).toBe('area');
  });

  it('writes LiNo that the official parser reads', () => {
    const spec = chartFromLinks(parse(fixture('products-bar.lino')));
    const text = chartToLino(spec);
    expect(text.startsWith('(products: chart\n')).toBe(true);
    expect(text).toContain("(title 'Sales by product')");
    expect(parse(text).length).toBeGreaterThan(0);
  });
});

describe('ChartSpecError', () => {
  it('names an unknown mark with the position of its link', () => {
    const error = thrown(() =>
      chartFromLinks(parse(fixture('bad-unknown-mark.lino')))
    );
    expect(error instanceof ChartSpecError).toBe(true);
    expect(error.code).toBe('unknown-mark');
    expect(error.path).toEqual([0, 2]);
    expect(error.link).toBe('(mark pie)');
    expect(error.message).toContain('unknown mark "pie"');
    expect(error.message).toContain('link 1 > 3: (mark pie)');
  });

  it('names a field missing from the data with the position of its link', () => {
    const error = thrown(() =>
      chartFromLinks(parse(fixture('bad-missing-field.lino')))
    );
    expect(error.code).toBe('missing-field');
    expect(error.path).toEqual([0, 3, 2, 1]);
    expect(error.link).toBe('(field c)');
  });

  for (const [name, text, code, link] of [
    [
      'a chart without a mark',
      '(c: chart (data (row (a 1))))',
      'missing-mark',
      null,
    ],
    [
      'a channel without a field',
      '(c: chart (data (row (a 1))) (mark bar) (encoding (x (type nominal)) (y (field a))))',
      'missing-field',
      '(x (type nominal))',
    ],
    [
      'a missing channel',
      '(c: chart (data (row (a 1))) (mark line) (encoding (x (field a))))',
      'missing-channel',
      '(encoding (x (field a)))',
    ],
    [
      'an unknown field type',
      '(c: chart (data (row (a 1))) (mark arc) (encoding (theta (field a) (type amount))))',
      'unknown-type',
      '(type amount)',
    ],
    [
      'a channel the mark has no use for',
      '(c: chart (data (row (a 1) (b 2))) (mark arc) (encoding (theta (field a)) (x (field b))))',
      'unknown-channel',
      '(x (field b))',
    ],
    [
      'an unknown property',
      '(c: chart (colour red) (data (row (a 1))) (mark arc))',
      'unknown-property',
      '(colour red)',
    ],
    [
      'a text in a quantitative field',
      '(c: chart (data (row (a x))) (mark arc) (encoding (theta (field a) (type quantitative))))',
      'invalid-value',
      '(a x)',
    ],
    [
      'an impossible date',
      '(c: chart (data (row (d 2026-13) (v 1))) (mark line) (encoding (x (field d) (type temporal)) (y (field v))))',
      'invalid-value',
      '(d 2026-13)',
    ],
    [
      'a gauge without a value',
      '(g: gauge (label CPU))',
      'missing-field',
      '(g: gauge (label CPU))',
    ],
    ['no chart at all', '(button (text Hi))', 'not-a-chart', null],
  ]) {
    it(`rejects ${name}`, () => {
      const error = thrown(() => parseChart(text));
      expect(error instanceof ChartSpecError).toBe(true);
      expect(error.code).toBe(code);
      if (link !== null) {
        expect(error.link).toBe(link);
      }
      expect(Array.isArray(error.path)).toBe(true);
    });
  }
});
