/**
 * The chart gallery (examples/charts.html) in real browsers: all five
 * marks and the small charts render with an accessible name and a data
 * table twin, the page passes axe in light and dark, the arrow keys move
 * between points and announce them through aria-live, and ECharts loads
 * only when a `(renderer echarts)` chart is shown.
 *
 * Screenshots are attached to the test report (light and dark gallery, a
 * focused point with its tooltip, the data table shown).
 */
import { URL } from 'node:url';
import { expect, test } from '@playwright/test';

import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const GALLERY = '/packages/ui-components/examples/charts.html';
const MARKS = ['line', 'area', 'bar', 'point', 'arc'];

/** Opens the gallery and waits until every chart has drawn its SVG. */
async function open(page) {
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(message.text());
    }
  });
  await page.goto(GALLERY);
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        'ui-chart svg[role="img"], ui-gauge svg, ui-stat-tile svg, ui-sparkline svg'
      ).length >= 8
  );
  return problems;
}

/** Attaches a screenshot of `target` to the report. */
async function attach(testInfo, target, name) {
  await testInfo.attach(name, {
    body: await target.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
}

test.describe('chart gallery', () => {
  for (const theme of ['light', 'dark']) {
    test(`renders the five marks and passes axe (${theme})`, async ({
      page,
    }, testInfo) => {
      const problems = await open(page);
      if (theme === 'dark') {
        await page.locator('#theme').click();
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          'dark'
        );
      }
      for (const mark of MARKS) {
        const svg = page.locator(
          `section[data-mark="${mark}"] ui-chart svg[role="img"]`
        );
        await expect(svg).toHaveCount(1);
        expect((await svg.getAttribute('aria-label')).trim()).not.toBe('');
        // The marks layer holds the drawn data.
        const marks = await svg.evaluate(
          (element) => element.querySelectorAll('.ui-chart-marks *').length
        );
        expect(marks).toBeGreaterThan(0);
      }
      await expectAccessible(page);
      expect(problems).toEqual([]);
      await attach(testInfo, page.locator('main'), `gallery-${theme}.png`);
    });
  }

  test('gives every chart a non-empty accessible name and a table twin', async ({
    page,
  }) => {
    await open(page);
    const charts = page.locator(
      'ui-chart, ui-gauge, ui-stat-tile, ui-sparkline'
    );
    const count = await charts.count();
    expect(count).toBe(8);
    for (let i = 0; i < count; i += 1) {
      const chart = charts.nth(i);
      const image = chart.getByRole('img').first();
      expect((await image.getAttribute('aria-label')).trim()).not.toBe('');
      await expect(chart.locator('table caption')).toHaveCount(1);
      expect(await chart.locator('table tbody tr').count()).toBeGreaterThan(0);
    }
  });

  test('moves between points with the arrow keys and announces them', async ({
    page,
  }, testInfo) => {
    await open(page);
    const chart = page.locator('#chart-line');
    const canvas = chart.locator('.ui-chart-canvas');
    const live = chart.locator('.ui-chart-live');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await canvas.focus();
    await page.keyboard.press('ArrowRight');
    await expect(live).toHaveText(
      'Month: Jan 2026, Sales, thousand USD: 12, point 1 of 6'
    );
    await page.keyboard.press('ArrowRight');
    await expect(live).toHaveText(
      'Month: Feb 2026, Sales, thousand USD: 18, point 2 of 6'
    );
    const tooltip = chart.locator('.ui-chart-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(
      'Month: Feb 2026, Sales, thousand USD: 18'
    );
    await expect(chart.locator('svg .ui-chart-focus')).toHaveCount(1);
    await attach(testInfo, chart, 'sales-focused-point.png');
    await page.keyboard.press('End');
    await expect(live).toHaveText(
      'Month: Jun 2026, Sales, thousand USD: 30, point 6 of 6'
    );
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
  });

  test('shows the data table with the "Show data table" button', async ({
    page,
  }, testInfo) => {
    await open(page);
    const chart = page.locator('#chart-line');
    const toggle = chart.getByRole('button', { name: 'Show data table' });
    const table = chart.locator('table');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(
      chart.getByRole('button', { name: 'Hide data table' })
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(6);
    await expectAccessible(page, { include: '#chart-line' });
    await attach(testInfo, chart, 'sales-table-shown.png');
  });

  test('loads ECharts only for a (renderer echarts) chart', async ({
    page,
  }) => {
    const requests = [];
    page.on('request', (request) => requests.push(request.url()));
    await open(page);
    const lazy = () =>
      requests.filter((url) => /echarts/u.test(new URL(url).pathname));
    expect(lazy()).toEqual([]);
    await page.locator('#load-echarts').click();
    const chart = page.locator('#chart-echarts');
    await expect(chart).toHaveAttribute('data-renderer', 'echarts');
    await expect(chart.locator('.ui-chart-echarts svg')).not.toHaveCount(0);
    const loaded = lazy().map((url) => new URL(url).pathname);
    expect(loaded.some((path) => path.endsWith('/echarts-adapter.js'))).toBe(
      true
    );
    expect(loaded.some((path) => path.includes('/node_modules/echarts/'))).toBe(
      true
    );
    // The accessible image is still the SVG renderer's.
    expect(
      (await chart.locator('svg[role="img"]').getAttribute('aria-label')).trim()
    ).not.toBe('');
  });
});
