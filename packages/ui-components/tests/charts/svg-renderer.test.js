/**
 * renderChartSvg: deterministic SVG of every mark and small chart, checked
 * against committed snapshots, with an accessible name and token colours.
 */

import { describe, it, expect } from 'test-anywhere';
import { chartsFromLinks } from '../../src/charts/chart-model.js';
import { layoutChart } from '../../src/charts/layout.js';
import { parseLino } from '../../src/charts/lino.js';
import { renderChartSvg } from '../../src/charts/svg-renderer.js';
import { CHART_TOKENS } from '../../src/charts/tokens.js';
import { chartFixtures, fixture, snapshot } from './helpers.js';

const specs = () =>
  chartFixtures().flatMap((file) => chartsFromLinks(parseLino(fixture(file))));

describe('renderChartSvg', () => {
  it('writes the same SVG on two runs, equal to the snapshot', () => {
    for (const spec of specs()) {
      const first = renderChartSvg(spec);
      const second = renderChartSvg(JSON.parse(JSON.stringify(spec)));
      expect(second).toBe(first);
      expect(`${first}\n`).toBe(snapshot(`${spec.id}.svg`, `${first}\n`));
    }
  });

  it('draws every mark', () => {
    const marks = Object.fromEntries(
      specs()
        .filter((spec) => spec.kind === 'chart')
        .map((spec) => [spec.mark.type, renderChartSvg(spec)])
    );
    expect(Object.keys(marks).sort()).toEqual([
      'arc',
      'area',
      'bar',
      'line',
      'point',
    ]);
    expect(marks.line).toContain('<path d="M');
    expect(marks.area).toContain('fill-opacity="0.35"');
    expect((marks.bar.match(/<rect /gu) ?? []).length).toBeGreaterThanOrEqual(
      4
    );
    expect((marks.point.match(/<circle /gu) ?? []).length).toBe(6);
    expect((marks.arc.match(/data-row=/gu) ?? []).length).toBe(4);
  });

  it('gives every chart role="img" and a non-empty aria-label', () => {
    for (const spec of specs()) {
      const svg = renderChartSvg(spec);
      expect(svg).toMatch(/^<svg [^>]*role="img"/u);
      expect(svg).toMatch(/aria-label="[^"]+"/u);
      expect(svg).toContain('<title>');
    }
  });

  it('uses the token custom properties, or literal tokens when given', () => {
    const [spec] = chartsFromLinks(parseLino(fixture('regions-area.lino')));
    const themed = renderChartSvg(spec);
    expect(themed).toContain('var(--color-chart-1, #1f6fb2)');
    expect(themed).toContain('var(--color-chart-2, #c2410c)');
    const dark = renderChartSvg(spec, { tokens: CHART_TOKENS.dark });
    expect(dark).toContain('fill:#60a5fa');
    expect(dark).not.toContain('var(');
    const map = new Map([['color.chart.1', '#000000']]);
    expect(renderChartSvg(spec, { tokens: map })).toContain('fill:#000000');
  });

  it('honours the width and height options', () => {
    const [spec] = chartsFromLinks(parseLino(fixture('sales-line.lino')));
    const svg = renderChartSvg(spec, { width: 400, height: 200 });
    expect(svg).toContain('viewBox="0 0 400 200"');
  });

  it('escapes text', () => {
    const [spec] = chartsFromLinks(
      parseLino(
        `(c: chart (title '<b> & "q"') (data (row (k '<x>') (v 1))) (mark bar) (encoding (x (field k)) (y (field v))))`
      )
    );
    const svg = renderChartSvg(spec);
    expect(svg).toContain('&lt;b&gt; &amp; &quot;q&quot;');
    expect(svg).not.toContain('<x>');
  });
});

describe('layoutChart', () => {
  it('stacks the series of an area chart', () => {
    const [spec] = chartsFromLinks(parseLino(fixture('regions-area.lino')));
    const layout = layoutChart(spec);
    const [north, south] = layout.series;
    expect(north.key).toBe('North');
    expect(south.points.length).toBe(6);
    // South sits on top of North: a smaller y in SVG pixels.
    expect(south.points[0].y).toBeLessThan(north.points[0].y);
  });

  it('gives each point its announcement text', () => {
    const [spec] = chartsFromLinks(parseLino(fixture('sales-line.lino')));
    const [series] = layoutChart(spec).series;
    expect(series.points.map((p) => p.text)).toContain(
      'Month: Jan 2026, Sales, thousand USD: 12'
    );
  });

  it('draws horizontal bars for a nominal y', () => {
    const [spec] = chartsFromLinks(
      parseLino(
        '(h: chart (data (row (k a) (v 3)) (row (k b) (v 5))) (mark bar) (encoding (x (field v)) (y (field k))))'
      )
    );
    const { series, plot } = layoutChart(spec);
    const [a, b] = series[0].points;
    expect(a.x).toBeLessThan(b.x);
    expect(a.y).toBeLessThan(plot.y + plot.height);
  });
});
