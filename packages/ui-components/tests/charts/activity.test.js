/* eslint local/no-changelog-comments: ["warn", {"allowDatesInStrings": true}] -- Calendar dates are test inputs. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseChart,
  chartToLino,
  layoutChart,
  renderChartSvg,
  chartTable,
} from '../../src/charts/index.js';

const chart = (mark, rows, encoding, extra = '') =>
  parseChart(`activity: chart
  title Activity
  mark ${mark}
  data
${rows
  .map(
    (row) =>
      `    row\n${Object.entries(row)
        .map(([k, v]) => `      ${k} ${v}`)
        .join('\n')}`
  )
  .join('\n')}
  encoding
${encoding}
${extra}`);
const xy =
  '    x\n      field day\n      type nominal\n    y\n      field value\n      type quantitative';

test('log decades are evenly spaced and nonpositive values are finite and diagnosed', () => {
  const spec = chart(
    'line',
    [0, -2, 1, 10, 100, 1000, 10000, 100000].map((value, day) => ({
      day,
      value,
    })),
    `${xy}\n      scale\n        type log\n        base 10`
  );
  assert.deepEqual(parseChart(chartToLino(spec)), spec);
  const layout = layoutChart(spec);
  const ys = layout.series[0].points.slice(2).map((p) => p.y);
  const step = ys[1] - ys[0];
  for (let i = 2; i < ys.length; i++) {
    assert.ok(Math.abs(ys[i] - ys[i - 1] - step) < 0.02);
  }
  assert.equal(layout.diagnostics.length, 2);
  assert.ok(!/NaN|Infinity/.test(renderChartSvg(spec)));
  assert.deepEqual(
    layout.axes[1].ticks.map((t) => t.value),
    [1, 10, 100, 1000, 10000, 100000]
  );
});

test('calendar lays out 53 weeks, five legend levels and every nonempty day in table', () => {
  const rows = Array.from({ length: 365 }, (_, i) => ({
    date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
    value: i % 8,
  }));
  const spec = chart(
    'calendar',
    rows,
    '    x\n      field date\n      type temporal\n    y\n      field value\n      type quantitative',
    '  week-start 1\n  thresholds 1 3 5 7'
  );
  assert.deepEqual(parseChart(chartToLino(spec)), spec);
  const layout = layoutChart(spec);
  assert.equal(layout.weeks, 53);
  assert.equal(layout.legend.length, 5);
  assert.equal(layout.series[0].points.length, 365);
  assert.equal(chartTable(spec).rows.length, 365);
  assert.match(renderChartSvg(spec), /2025-01-01: 0/);
});

test('composition topN preserves total, draws Other last and muted', () => {
  const spec = chart(
    'composition',
    Array.from({ length: 8 }, (_, i) => ({ name: `n${i}`, value: i + 1 })),
    '    theta\n      field value\n      type quantitative\n    color\n      field name\n      type nominal',
    '  top-n 5'
  );
  const layout = layoutChart(spec);
  assert.equal(layout.legend.length, 6);
  assert.match(layout.legend.at(-1).label, /^Other /);
  assert.match(layout.legend.at(-1).color, /muted/);
  const widths = layout.series[0].shapes.map((s) => s.attrs.width);
  assert.ok(
    Math.abs(widths.reduce((a, b) => a + b, 0) - layout.plot.width) < 0.001
  );
  assert.equal(chartTable(spec).rows.length, 8);
});

test('ranges have ongoing ends, year ticks and greyscale category patterns', () => {
  const spec = chart(
    'range',
    [
      { name: 'A', start: '2020-01-01', end: '2022-01-01', category: 'work' },
      { name: 'B', start: '2021-01-01', category: 'study' },
    ],
    '    x\n      field start\n      type temporal\n    x2\n      field end\n      type temporal\n    y\n      field name\n      type nominal\n    color\n      field category\n      type nominal',
    '  ongoing-end 2025-01-01'
  );
  assert.deepEqual(parseChart(chartToLino(spec)), spec);
  const layout = layoutChart(spec);
  assert.match(layout.series[0].points[1].text, /ongoing/);
  assert.deepEqual(
    layout.legend.map((l) => l.pattern),
    ['solid', 'hatched']
  );
  assert.ok(layout.axes[0].ticks.every((t) => /^\d{4}$/.test(t.label)));
  assert.match(renderChartSvg(spec), /pattern/);
});

test('tag clouds keep countless items and logarithmically size counted items', () => {
  const spec = parseChart(`tags: tag-cloud
  label Languages
  min-size 12
  max-size 36
  items
    item JavaScript
      count 100
      color blue
      emphasis true
    item Rust
      count 10
    item Other`);
  assert.deepEqual(parseChart(chartToLino(spec)), spec);
  assert.equal(spec.items.length, 3);
});

test('stat tiles compact above threshold and expose exact value, hints and footnotes', () => {
  const spec = parseChart(`total: stat-tile
  label Total
  value 123456
  notation compact
  hint Contributions
  footnote
    label Source
    href 'https://example.com'`);
  assert.deepEqual(parseChart(chartToLino(spec)), spec);
  const svg = renderChartSvg(spec);
  assert.match(svg, /123K/);
  assert.match(svg, /123456/);
  assert.match(svg, /Contributions/);
});

test('bars round only value ends and show peak/last labels and emphasis', () => {
  const spec = chart(
    'bar',
    [1, 4, 2, 5, 1].map((value, day) => ({
      day,
      value,
      favourite: day === 1 ? 'true' : 'false',
    })),
    xy,
    '  corner-radius 4\n  labels peaks\n  emphasis favourite'
  );
  const svg = renderChartSvg(spec);
  assert.match(svg, /Q/);
  assert.match(svg, /★/);
  assert.equal(
    layoutChart(spec).series[0].shapes.filter((s) => s.tag === 'text').length,
    2
  );
});

test('activity options reject invalid types, dates, sizes, thresholds and unsafe links', () => {
  for (const extra of [
    '  corner-radius -1',
    '  top-n 0',
    '  week-start 7',
    '  thresholds 1 1 2 3',
    '  labels all',
    '  tooltip\n    layer page',
  ]) {
    assert.throws(() => chart('bar', [{ day: 'A', value: 1 }], xy, extra));
  }
  assert.throws(() => chart('calendar', [{ day: 'A', value: 1 }], xy));
  assert.throws(() =>
    chart(
      'line',
      [{ day: 'ongoing', value: 1 }],
      xy.replace('nominal', 'temporal')
    )
  );
  assert.throws(() =>
    chart(
      'line',
      [{ day: 'A', value: 1 }],
      xy.replace('type nominal', 'scale\n        type log')
    )
  );
  assert.throws(() =>
    parseChart(
      'tags: tag-cloud\n  min-size 30\n  max-size 12\n  items\n    item A'
    )
  );
  assert.throws(() =>
    parseChart(
      "s: stat-tile\n  value 1\n  footnote\n    href 'javascript:alert(1)'"
    )
  );
});

test('compact threshold, last labels and all-nonpositive logs preserve exact data', () => {
  const small = parseChart('s: stat-tile\n  value 9999\n  notation compact');
  assert.doesNotMatch(renderChartSvg(small), /10K/);
  const spec = chart(
    'line',
    [
      { day: 'A', value: 0 },
      { day: 'B', value: -1 },
    ],
    `${xy}\n      scale\n        type log`,
    '  labels last'
  );
  const layout = layoutChart(spec);
  assert.equal(layout.diagnostics.length, 2);
  assert.ok(!/NaN|Infinity/.test(renderChartSvg(spec)));
  assert.equal(
    layout.series[0].shapes.filter((s) => s.tag === 'text').length,
    1
  );
  assert.equal(chartTable(spec).rows[1][1], '-1');
});

test('tag size interpolation is monotonic, bounded and countless items stay smallest', async () => {
  const { tagSizes } = await import('../../src/charts/tag-cloud.js');
  const sizes = tagSizes({
    minSize: 14,
    maxSize: 36,
    items: [{}, { count: 0 }, { count: 1 }, { count: 10 }, { count: 1000 }],
  });
  assert.deepEqual(sizes.slice(0, 2), [14, 14]);
  assert.equal(sizes.at(-1), 36);
  assert.ok(sizes.every((size, i) => i === 0 || size >= sizes[i - 1]));
});

test('rich tooltip content renders hostile values as text and extended specs use SVG', async () => {
  const { JSDOM } = await import('jsdom');
  const { tooltipContent } = await import('../../src/charts/tooltip.js');
  const { toEChartsOption } =
    await import('../../src/charts/echarts-adapter.js');
  const dom = new JSDOM('<!doctype html><div></div>');
  const tooltip = dom.window.document.querySelector('div');
  const datum = { value: 4 };
  tooltipContent(
    tooltip,
    { datum },
    {
      tooltip: {
        content: (row) => ({
          title: '<img src=x>',
          value: row.value,
          rows: [['<b>', 'safe']],
        }),
      },
    }
  );
  assert.equal(tooltip.querySelector('img'), null);
  assert.equal(tooltip.querySelector('dt').textContent, '<b>');
  assert.match(tooltip.textContent, /4/);
  assert.throws(
    () =>
      toEChartsOption(
        chart('bar', [{ day: 'A', value: 1 }], xy, '  labels last')
      ),
    /SVG renderer/
  );
  dom.window.close();
});
