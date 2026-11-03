/**
 * The ECharts adapter: a pure, deterministic option of every mark, and
 * rendering through an injected loader (no ECharts needed).
 */

import { describe, it, expect } from 'test-anywhere';
import { JSDOM } from 'jsdom';
import { chartsFromLinks } from '../../src/charts/chart-model.js';
import { parseLino } from '../../src/charts/lino.js';
import { CHART_TOKENS } from '../../src/charts/tokens.js';
import {
  renderECharts,
  toEChartsOption,
} from '../../src/charts/echarts-adapter.js';
import { defineChartElements } from '../../src/index.js';
import { chartFixtures, fixture } from './helpers.js';

const charts = () =>
  chartFixtures()
    .flatMap((file) => chartsFromLinks(parseLino(fixture(file))))
    .filter((spec) => spec.kind === 'chart');

const byMark = (type) => charts().find((spec) => spec.mark.type === type);

/** Whether a value holds a function anywhere (an option must be data). */
const hasFunction = (value) =>
  typeof value === 'function' ||
  (value !== null &&
    typeof value === 'object' &&
    Object.values(value).some(hasFunction));

/** A fake ECharts module that records what it was given. */
function fakeECharts() {
  const calls = [];
  const instance = {
    setOption: (option) => calls.push(['setOption', option]),
    dispatchAction: (action) => calls.push(['dispatchAction', action]),
  };
  return {
    calls,
    module: {
      init: (container, theme, options) => {
        calls.push(['init', container, options]);
        return instance;
      },
    },
  };
}

describe('toEChartsOption', () => {
  it('is deterministic plain data for every chart fixture', () => {
    for (const spec of charts()) {
      const first = toEChartsOption(spec);
      expect(toEChartsOption(spec)).toEqual(first);
      expect(hasFunction(first)).toBe(false);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
      expect(first.animation).toBe(false);
      expect(first.aria.enabled).toBe(true);
      expect(first.aria.label.description.length > 0).toBe(true);
    }
  });

  it('maps the marks to ECharts series types', () => {
    const type = (mark) => toEChartsOption(byMark(mark)).series[0].type;
    expect(type('line')).toBe('line');
    expect(type('area')).toBe('line');
    expect(type('bar')).toBe('bar');
    expect(type('point')).toBe('scatter');
    expect(type('arc')).toBe('pie');
    const area = toEChartsOption(byMark('area'));
    expect(area.series.every((series) => series.stack === 'total')).toBe(true);
    expect(area.series[0].areaStyle.opacity).toBe(0.35);
  });

  it('keeps the series and points in the order of the layout', () => {
    const area = toEChartsOption(byMark('area'));
    expect(area.series.map((series) => series.name)).toEqual([
      'North',
      'South',
    ]);
    expect(area.series[0].data.length).toBe(6);
    expect(area.legend === undefined).toBe(false);
    const line = toEChartsOption(byMark('line'));
    expect(line.series[0].data[0].value).toEqual([Date.UTC(2026, 0, 1), 12]);
    expect(line.xAxis.type).toBe('time');
    expect(line.yAxis.type).toBe('value');
    const bar = toEChartsOption(byMark('bar'));
    expect(bar.xAxis.type).toBe('category');
    expect(bar.xAxis.data.length).toBe(4);
  });

  it('uses the literal chart token colours of the theme', () => {
    const spec = byMark('line');
    expect(toEChartsOption(spec).color[0]).toBe(
      CHART_TOKENS.light['color.chart.1']
    );
    const dark = toEChartsOption(spec, { theme: 'dark' });
    expect(dark.color[0]).toBe(CHART_TOKENS.dark['color.chart.1']);
    expect(dark.backgroundColor).toBe(
      CHART_TOKENS.dark['color.chart.background']
    );
  });

  it('gives the arc slices their colours and point tooltips', () => {
    const pie = toEChartsOption(byMark('arc')).series[0];
    expect(pie.data.length).toBe(4);
    expect(pie.radius[0] > 0).toBe(true);
    expect(pie.data[0].itemStyle.color).toBe(
      CHART_TOKENS.light['color.chart.1']
    );
    expect(typeof pie.data[0].tooltip.formatter).toBe('string');
  });

  it('refuses a small chart spec', () => {
    const [gauge] = chartsFromLinks(parseLino('(cpu: gauge (value 3))'));
    expect(() => toEChartsOption(gauge)).toThrow(TypeError);
  });
});

describe('renderECharts', () => {
  it('loads ECharts through the loader and sets the option', async () => {
    const { calls, module } = fakeECharts();
    const container = {};
    const spec = byMark('line');
    const { option } = await renderECharts(container, spec, {
      loadECharts: async () => ({ default: module }),
      width: 400,
      height: 200,
    });
    expect(calls[0][0]).toBe('init');
    expect(calls[0][1]).toBe(container);
    expect(calls[0][2]).toEqual({ renderer: 'svg', width: 400, height: 200 });
    expect(calls[1]).toEqual(['setOption', option]);
    expect(option).toEqual(toEChartsOption(spec, { width: 400, height: 200 }));
  });
});

describe('<ui-chart> with (renderer echarts)', () => {
  const lino = fixture('sales-line.lino').replace(
    '(sales: chart',
    '(sales: chart (renderer echarts)'
  );

  it('draws with ECharts and keeps the SVG as the accessible image', async () => {
    const win = new JSDOM('<!doctype html><body></body>').window;
    defineChartElements(win);
    const chart = win.document.createElement('ui-chart');
    const { calls, module } = fakeECharts();
    chart.loadECharts = async () => module;
    chart.lino = lino;
    win.document.body.append(chart);
    await chart.ready;
    expect(chart.getAttribute('data-renderer')).toBe('echarts');
    const host = chart.querySelector('.ui-chart-echarts');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    const svg = chart.querySelector('svg');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.classList.contains('ui-visually-hidden')).toBe(true);
    chart
      .querySelector('.ui-chart-canvas')
      .dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(calls.at(-1)).toEqual([
      'dispatchAction',
      { type: 'showTip', seriesIndex: 0, dataIndex: 0 },
    ]);
    expect(chart.querySelector('.ui-chart-live').textContent).toBe(
      'Month: Jan 2026, Sales, thousand USD: 12, point 1 of 6'
    );
  });

  it('keeps the SVG and reports chart-error when ECharts fails to load', async () => {
    const win = new JSDOM('<!doctype html><body></body>').window;
    defineChartElements(win);
    const chart = win.document.createElement('ui-chart');
    const errors = [];
    chart.addEventListener('chart-error', (event) => errors.push(event.detail));
    chart.loadECharts = async () => {
      throw new Error('offline');
    };
    chart.lino = lino;
    win.document.body.append(chart);
    await chart.ready;
    expect(errors.map((error) => error.message)).toEqual(['offline']);
    expect(chart.querySelector('.ui-chart-echarts')).toBe(null);
    expect(chart.hasAttribute('data-renderer')).toBe(false);
    expect(
      chart.querySelector('svg').classList.contains('ui-visually-hidden')
    ).toBe(false);
  });
});
