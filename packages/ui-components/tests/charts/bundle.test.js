/**
 * ECharts is not part of the bundle unless `(renderer echarts)` is used.
 *
 * 1. The static import graph of the published entries (what a bundler
 *    puts in the main chunk) holds neither `echarts` nor the adapter; the
 *    only dynamic imports are `import('./echarts-adapter.js')` in chart.js
 *    and `import('echarts')` in the adapter, so both land in a lazy chunk.
 * 2. At run time (module resolve hooks record every module loaded), SVG
 *    charts never load the adapter or ECharts, and a `(renderer echarts)`
 *    chart loads both.
 */

import { describe, it, expect } from 'test-anywhere';
import { readFileSync, readdirSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { URL, fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { itUnless } from '../../../../tests/helpers/skip.js';
import { chartFixtures, fixture } from './helpers.js';

// Module resolve hooks (Node.js 22.15+, Deno); Bun has none.
const { registerHooks } = nodeModule;
const noHooks =
  typeof registerHooks === 'function'
    ? null
    : 'this runtime has no node:module registerHooks';

const SRC = new URL('../../src/', import.meta.url);
const ADAPTER = new URL('charts/echarts-adapter.js', SRC).href;

const STATIC_IMPORT =
  /^\s*(?:import|export)\s(?:[^;'"]*?\sfrom\s)?\s*'([^']+)'/gmu;
const DYNAMIC_IMPORT = /\bimport\(\s*'([^']+)'\s*\)/gu;

/** The code of a module without comments (JSDoc types use `import()`). */
const code = (url) =>
  readFileSync(url, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '');

/** The specifiers of a module's static imports and re-exports. */
const staticImports = (text) =>
  [...text.matchAll(STATIC_IMPORT)].map((match) => match[1]);

/**
 * The static import graph from an entry: the local modules it loads and
 * the packages they import.
 */
function staticGraph(entry) {
  const modules = new Set();
  const packages = new Set();
  const visit = (url) => {
    if (modules.has(url.href)) {
      return;
    }
    modules.add(url.href);
    for (const specifier of staticImports(code(url))) {
      if (specifier.startsWith('.')) {
        visit(new URL(specifier, url));
      } else {
        packages.add(specifier);
      }
    }
  };
  visit(entry);
  return { modules, packages };
}

describe('the bundle of the chart entries', () => {
  it('has no echarts in the static import graph', () => {
    for (const entry of ['index.js', 'charts/index.js']) {
      const { modules, packages } = staticGraph(new URL(entry, SRC));
      expect(modules.has(new URL('charts/chart.js', SRC).href)).toBe(true);
      expect(modules.has(ADAPTER)).toBe(false);
      expect(packages.has('echarts')).toBe(false);
    }
    const { packages } = staticGraph(new URL('charts/index.js', SRC));
    // ui-core reads the nested form of a chart (#133); it imports only
    // links-notation.
    expect([...packages].sort()).toEqual([
      '@floating-ui/dom',
      '@link-foundation/ui-core',
      'd3-scale',
      'd3-shape',
      'links-notation',
    ]);
  });

  it('loads the adapter and echarts only through dynamic imports', () => {
    const charts = new URL('charts/', SRC);
    const dynamic = readdirSync(charts)
      .filter((name) => name.endsWith('.js'))
      .flatMap((name) =>
        [...code(new URL(name, charts)).matchAll(DYNAMIC_IMPORT)].map(
          (match) => `${name} -> ${match[1]}`
        )
      )
      .sort();
    expect(dynamic).toEqual([
      'chart.js -> ./echarts-adapter.js',
      'echarts-adapter.js -> echarts',
    ]);
  });
});

describe('the modules loaded at run time', () => {
  const loaded = new Set();
  // A stand-in for ECharts: what <ui-chart> needs of `echarts.init`.
  const fake = `export function init() {
    return { setOption() {}, dispatchAction() {} };
  }`;
  registerHooks?.({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'echarts') {
        loaded.add('echarts');
        return {
          url: `data:text/javascript,${encodeURIComponent(fake)}`,
          shortCircuit: true,
        };
      }
      const result = nextResolve(specifier, context);
      loaded.add(result.url);
      return result;
    },
  });

  const chartTexts = () =>
    chartFixtures()
      .map((name) => fixture(name))
      .filter((text) => text.includes(': chart'));

  itUnless(noHooks)(
    'loads no echarts for SVG charts, and loads it for (renderer echarts)',
    async () => {
      const { defineChartElements } = await import(new URL('index.js', SRC));
      const win = new JSDOM('<!doctype html><body></body>').window;
      defineChartElements(win);
      for (const text of chartTexts()) {
        const chart = win.document.createElement('ui-chart');
        chart.lino = text;
        win.document.body.append(chart);
        await chart.ready;
      }
      expect(
        win.document.querySelectorAll('ui-chart svg[role="img"]').length
      ).toBe(chartTexts().length);
      expect(loaded.has('echarts')).toBe(false);
      expect(loaded.has(ADAPTER)).toBe(false);
      expect([...loaded].some((url) => url.includes('d3-scale'))).toBe(true);

      const chart = win.document.createElement('ui-chart');
      chart.lino = fixture('sales-line.lino').replace(
        'sales: chart\n',
        'sales: chart\n  renderer echarts\n'
      );
      win.document.body.append(chart);
      await chart.ready;
      expect(loaded.has(ADAPTER)).toBe(true);
      expect(loaded.has('echarts')).toBe(true);
      expect(chart.getAttribute('data-renderer')).toBe('echarts');
    }
  );

  it('records modules by file URL', () => {
    expect(fileURLToPath(ADAPTER).endsWith('echarts-adapter.js')).toBe(true);
  });
});
