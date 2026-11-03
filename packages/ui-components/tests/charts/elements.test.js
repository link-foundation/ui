/**
 * The chart custom elements in jsdom: where the spec comes from, the
 * accessible name, the data table twin and its toggle, keyboard moves with
 * the aria-live announcement, errors, and the small chart elements.
 */

import { describe, it, expect } from 'test-anywhere';
import { JSDOM } from 'jsdom';
import { chartFromLinks } from '../../src/charts/chart-model.js';
import { parseLino } from '../../src/charts/lino.js';
import { defineChartElements } from '../../src/index.js';
import { chartFixtures, fixture } from './helpers.js';

/** A jsdom window with the chart elements defined and `html` in the body. */
function page(html = '') {
  const dom = new JSDOM(
    '<!doctype html><html><head></head><body></body></html>'
  );
  const win = dom.window;
  defineChartElements(win);
  win.document.body.innerHTML = html;
  return win;
}

const inline = (lino, attrs = '') =>
  `<ui-chart ${attrs}><script type="text/lino">${lino}</script></ui-chart>`;

const press = (win, chart, key) =>
  chart
    .querySelector('.ui-chart-canvas')
    .dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true }));

const live = (chart) => chart.querySelector('.ui-chart-live').textContent;

/** The `(NAME: chart ...)` texts of the chart fixtures, one per link. */
const chartTexts = () =>
  chartFixtures()
    .map((name) => fixture(name))
    .filter((text) => text.includes(': chart'));

describe('<ui-chart>', () => {
  it('renders an SVG role="img" with a non-empty name for every fixture', () => {
    for (const text of chartTexts()) {
      const win = page(inline(text));
      const chart = win.document.querySelector('ui-chart');
      const svg = chart.querySelector('svg');
      expect(svg.getAttribute('role')).toBe('img');
      expect(svg.getAttribute('aria-label').length > 0).toBe(true);
      const canvas = chart.querySelector('.ui-chart-canvas');
      expect(canvas.getAttribute('aria-label').length > 0).toBe(true);
      expect(canvas.tabIndex).toBe(0);
    }
  });

  it('takes the accessible name from (description ...)', () => {
    const win = page(inline(fixture('sales-line.lino')));
    const svg = win.document.querySelector('ui-chart svg');
    expect(svg.getAttribute('aria-label')).toBe(
      'Sales grew from 12 to 30 thousand between January and June 2026'
    );
  });

  it('has a visually hidden table twin with one row per data row', () => {
    for (const text of chartTexts()) {
      const win = page(inline(text));
      const chart = win.document.querySelector('ui-chart');
      const table = chart.querySelector('table.ui-chart-table');
      const spec = chartFromLinks(parseLino(text));
      expect(table.classList.contains('ui-visually-hidden')).toBe(true);
      expect(table.querySelector('caption').textContent.length > 0).toBe(true);
      expect(table.querySelectorAll('tbody tr').length).toBe(
        spec.data.values.length
      );
      expect(table.querySelectorAll('th[scope="col"]').length > 0).toBe(true);
    }
  });

  it('shows and hides the table with the "Show data table" button', () => {
    const win = page(inline(fixture('sales-line.lino')));
    const chart = win.document.querySelector('ui-chart');
    const toggle = chart.querySelector('button.ui-chart-toggle');
    const table = chart.querySelector('table');
    expect(toggle.textContent).toBe('Show data table');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(table.id);
    toggle.click();
    expect(toggle.textContent).toBe('Hide data table');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(table.classList.contains('ui-visually-hidden')).toBe(false);
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(table.classList.contains('ui-visually-hidden')).toBe(true);
  });

  it('moves between points with the arrow keys and announces them', () => {
    const win = page(inline(fixture('sales-line.lino')));
    const chart = win.document.querySelector('ui-chart');
    const region = chart.querySelector('.ui-chart-live');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(live(chart)).toBe('');
    press(win, chart, 'ArrowRight');
    expect(live(chart)).toBe(
      'Month: Jan 2026, Sales, thousand USD: 12, point 1 of 6'
    );
    press(win, chart, 'ArrowRight');
    expect(live(chart)).toBe(
      'Month: Feb 2026, Sales, thousand USD: 18, point 2 of 6'
    );
    press(win, chart, 'End');
    expect(live(chart)).toBe(
      'Month: Jun 2026, Sales, thousand USD: 30, point 6 of 6'
    );
    press(win, chart, 'ArrowRight');
    expect(chart.activePoint.text).toBe(
      'Month: Jun 2026, Sales, thousand USD: 30'
    );
    press(win, chart, 'Home');
    press(win, chart, 'ArrowLeft');
    expect(chart.activePoint.row).toBe(0);
  });

  it('shows a tooltip and a focus ring on the active point', () => {
    const win = page(inline(fixture('sales-line.lino')));
    const chart = win.document.querySelector('ui-chart');
    const tooltip = chart.querySelector('.ui-chart-tooltip');
    expect(tooltip.hidden).toBe(true);
    press(win, chart, 'ArrowRight');
    expect(tooltip.hidden).toBe(false);
    expect(tooltip.getAttribute('role')).toBe('tooltip');
    expect(tooltip.textContent).toBe(
      'Month: Jan 2026, Sales, thousand USD: 12'
    );
    expect(chart.querySelector('svg .ui-chart-focus') === null).toBe(false);
    press(win, chart, 'Escape');
    expect(tooltip.hidden).toBe(true);
    expect(chart.querySelector('svg .ui-chart-focus')).toBe(null);
  });

  it('moves between series with Up and Down', () => {
    const win = page(inline(fixture('regions-area.lino')));
    const chart = win.document.querySelector('ui-chart');
    const events = [];
    chart.addEventListener('chart-point', (event) => events.push(event.detail));
    press(win, chart, 'ArrowRight');
    expect(live(chart).endsWith('point 1 of 6, series 1 of 2')).toBe(true);
    press(win, chart, 'ArrowDown');
    expect(live(chart).endsWith('point 1 of 6, series 2 of 2')).toBe(true);
    press(win, chart, 'ArrowDown');
    expect(chart.activePoint.text.includes('South')).toBe(true);
    expect(events.map((detail) => detail.series)).toEqual([0, 1, 1]);
  });

  it('reads the lino and spec properties', () => {
    const win = page('<ui-chart></ui-chart>');
    const chart = win.document.querySelector('ui-chart');
    expect(chart.spec).toBe(null);
    chart.lino = fixture('products-bar.lino');
    expect(chart.spec.mark.type).toBe('bar');
    expect(chart.querySelectorAll('figure').length).toBe(1);
    const spec = chartFromLinks(parseLino(fixture('share-arc.lino')));
    chart.spec = spec;
    expect(chart.spec).toEqual(spec);
    expect(chart.querySelectorAll('figure').length).toBe(1);
    expect(chart.querySelector('svg').getAttribute('role')).toBe('img');
  });

  it('reports a bad spec with its link position and a chart-error event', () => {
    const win = page('<ui-chart></ui-chart>');
    const chart = win.document.querySelector('ui-chart');
    const errors = [];
    chart.addEventListener('chart-error', (event) => errors.push(event.detail));
    chart.lino = fixture('bad-unknown-mark.lino');
    expect(errors.length).toBe(1);
    expect(errors[0].name).toBe('ChartSpecError');
    expect(Array.isArray(errors[0].path)).toBe(true);
    const alert = chart.querySelector('.ui-chart-error');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent.startsWith('Chart error: ')).toBe(true);
    expect(chart.spec).toBe(null);
  });

  it('shows a small chart spec as an SVG with a table twin', () => {
    const win = page(inline('(cpu: gauge (label CPU) (value 72) (unit %))'));
    const chart = win.document.querySelector('ui-chart');
    expect(
      chart.querySelector('svg').getAttribute('aria-label').length > 0
    ).toBe(true);
    expect(chart.querySelector('table.ui-visually-hidden') === null).toBe(
      false
    );
  });
});

describe('small chart elements', () => {
  it('render from attributes with an accessible name and a table twin', () => {
    const win = page(`
      <ui-gauge id="cpu" label="CPU" value="72" unit="%"></ui-gauge>
      <ui-stat-tile label="Revenue" value="30200" unit="USD" delta="12.5"
        trend="12 18 15 21 25 30"></ui-stat-tile>
      <ui-sparkline label="Visits" values="3 5 2 8 6 9" mark="area"></ui-sparkline>`);
    for (const tag of ['ui-gauge', 'ui-stat-tile', 'ui-sparkline']) {
      const element = win.document.querySelector(tag);
      const svg = element.querySelector('svg');
      expect(svg.getAttribute('role')).toBe('img');
      expect(svg.getAttribute('aria-label').length > 0).toBe(true);
      expect(element.querySelector('table caption') === null).toBe(false);
      expect(element.spec.kind).toBe(tag.slice(3));
    }
  });

  it('render again when an attribute changes', () => {
    const win = page('<ui-gauge label="CPU" value="10"></ui-gauge>');
    const gauge = win.document.querySelector('ui-gauge');
    expect(gauge.spec.value).toBe(10);
    gauge.setAttribute('value', '55');
    expect(gauge.spec.value).toBe(55);
    expect(gauge.querySelectorAll('svg').length).toBe(1);
  });

  it('escape attribute values through the LiNo writer', () => {
    const win = page(`<ui-gauge label="CPU (core 'a')" value="10"></ui-gauge>`);
    const gauge = win.document.querySelector('ui-gauge');
    expect(gauge.spec.label).toBe("CPU (core 'a')");
  });

  it('refuse a chart kind they do not show', () => {
    const win = page(
      `<ui-gauge><script type="text/lino">${fixture('sales-line.lino')}</script></ui-gauge>`
    );
    const alert = win.document.querySelector('ui-gauge .ui-chart-error');
    expect(alert.textContent.includes('not chart')).toBe(true);
  });

  it('are defined once per window', () => {
    const win = page();
    const first = win.customElements.get('ui-chart');
    expect(defineChartElements(win).chart).toBe(first);
  });
});
