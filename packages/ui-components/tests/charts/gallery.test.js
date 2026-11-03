/**
 * The gallery (examples/charts.html) shows the fixtures: one chart of each
 * of the five marks, read by the chart model to the same spec as the
 * fixture, plus the small charts.
 */

import { describe, it, expect } from 'test-anywhere';
import { existsSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { JSDOM } from 'jsdom';
import {
  MARKS,
  chartsFromLinks,
  parseChart,
} from '../../src/charts/chart-model.js';
import { parseLino } from '../../src/charts/lino.js';
import { chartFixtures, fixture } from './helpers.js';

const html = readFileSync(
  new URL('../../examples/charts.html', import.meta.url),
  'utf8'
);
const { document } = new JSDOM(html).window;

const fixtureSpecs = new Map(
  chartFixtures()
    .flatMap((name) => chartsFromLinks(parseLino(fixture(name))))
    .map((spec) => [spec.id, spec])
);

describe('the chart gallery', () => {
  it('shows one chart of each mark, equal to its fixture', () => {
    const marks = [];
    for (const section of document.querySelectorAll('section[data-mark]')) {
      const script = section.querySelector(
        'ui-chart > script[type="text/lino"]'
      );
      if (script === null) {
        continue;
      }
      const spec = parseChart(script.textContent);
      expect(spec.mark.type).toBe(section.getAttribute('data-mark'));
      expect(spec).toEqual(fixtureSpecs.get(spec.id));
      marks.push(spec.mark.type);
    }
    expect(marks.sort()).toEqual([...MARKS].sort());
  });

  it('shows a gauge, a stat tile and a sparkline with labels', () => {
    for (const tag of ['ui-gauge', 'ui-stat-tile', 'ui-sparkline']) {
      const element = document.querySelector(tag);
      expect(element === null).toBe(false);
      expect(element.getAttribute('label').length > 0).toBe(true);
    }
  });

  it('maps every import to a file in the repository', () => {
    const map = JSON.parse(
      document.querySelector('script[type="importmap"]').textContent
    );
    const root = new URL('../../../../', import.meta.url);
    for (const [name, path] of Object.entries(map.imports)) {
      expect([name, existsSync(new URL(`.${path}`, root))]).toEqual([
        name,
        true,
      ]);
    }
  });

  it('has an ECharts section that loads nothing until asked', () => {
    expect(document.querySelector('#load-echarts').tagName).toBe('BUTTON');
    expect(document.querySelector('ui-chart#chart-echarts')).toBe(null);
    expect(html.includes("import('echarts')")).toBe(false);
  });
});
