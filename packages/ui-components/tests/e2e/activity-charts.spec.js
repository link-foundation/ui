/* eslint local/no-changelog-comments: ["warn", {"allowDatesInStrings": true}] -- Calendar dates are test inputs. */
import { expect, test } from '@playwright/test';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const GALLERY = '/packages/ui-components/examples/activity-charts.html';
async function open(page) {
  await page.goto(GALLERY);
  await expect(page.locator('#activity-calendar svg')).toHaveCount(1);
  await expect(page.locator('#activity-log svg')).toHaveCount(1);
}

for (const theme of ['light', 'dark']) {
  test(`activity charts pass axe and render (${theme})`, async ({
    page,
  }, testInfo) => {
    await open(page);
    if (theme === 'dark') {
      await page.locator('#theme').click();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight)
    ).toBeLessThan(4000);
    await expectAccessible(page);
    await expect(page.locator('#activity-cloud ul li')).toHaveCount(4);
    await expect(page.locator('#activity-cloud li').last()).toHaveCSS(
      'font-size',
      '14px'
    );
    await expect(page.locator('#activity-stat svg')).toHaveAttribute(
      'aria-label',
      /123456/
    );
    await expect(page.locator('#activity-stat')).toContainText('123K');
    await expect(page.locator('#activity-stat a')).toHaveAttribute(
      'href',
      'https://example.com/data'
    );
    await testInfo.attach(`activity-${theme}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
}

test('calendar opens at newest week and arrow keys move by day/week', async ({
  page,
}) => {
  await open(page);
  const canvas = page.locator('#activity-calendar .ui-chart-canvas');
  expect(await canvas.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await canvas.focus();
  await page.keyboard.press('Home');
  const chart = page.locator('#activity-calendar');
  await expect(chart.locator('.ui-chart-live')).toContainText('2025-01-01');
  await page.keyboard.press('ArrowDown');
  await expect(chart.locator('.ui-chart-live')).toContainText('2025-01-02');
  await page.keyboard.press('ArrowRight');
  await expect(chart.locator('.ui-chart-live')).toContainText('2025-01-09');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await expect(chart.locator('.ui-chart-live')).toContainText('2025-01-01');
  await page.keyboard.press('End');
  await expect(chart.locator('.ui-chart-live')).toContainText('2025-12-31');
  await chart.getByRole('button', { name: 'Show data table' }).click();
  await expect(chart.locator('tbody tr')).toHaveCount(365);
});

test('top-layer tooltip escapes clip-path and anchors to mark or pointer', async ({
  page,
}, testInfo) => {
  await open(page);
  const chart = page.locator('#activity-log');
  const canvas = chart.locator('.ui-chart-canvas');
  await chart.evaluate((el) => {
    el.spec = { ...el.spec, tooltip: { ...el.spec.tooltip, layer: 'inline' } };
  });
  await canvas.evaluate((el) => {
    el.style.clipPath = 'inset(0 0 calc(100% - 70px) 0)';
  });
  await canvas.focus();
  await page.keyboard.press('End');
  await testInfo.attach('clipped-tooltip-before', {
    body: await chart.screenshot(),
    contentType: 'image/png',
  });
  await chart.evaluate((el) => {
    el.spec = { ...el.spec, tooltip: { ...el.spec.tooltip, layer: 'top' } };
  });
  await canvas.evaluate((el) => {
    el.style.clipPath = 'inset(0 0 calc(100% - 70px) 0)';
  });
  await canvas.focus();
  await page.keyboard.press('End');
  const tooltip = chart.locator('[role="tooltip"]');
  await expect(tooltip).toBeVisible();
  expect(await tooltip.evaluate((el) => el.matches(':popover-open'))).toBe(
    true
  );
  await expect(tooltip).toContainText('100000');
  const mark = await chart.evaluate((el) => el.activePoint);
  const svg = await chart.locator('svg').boundingBox();
  const scale = svg.width / 640;
  await expect
    .poll(async () =>
      Math.abs((await tooltip.boundingBox()).y - (svg.y + mark.y * scale))
    )
    .toBeLessThan(2);
  const bounds = await tooltip.boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(svg.x + mark.x * scale);
  expect(Math.abs(bounds.y - (svg.y + mark.y * scale))).toBeLessThan(2);
  const clipped = await canvas.boundingBox();
  expect(bounds.y + bounds.height).toBeGreaterThan(clipped.y + 70);
  await testInfo.attach('clipped-tooltip-after', {
    body: await chart.screenshot(),
    contentType: 'image/png',
  });
  const pointer = {
    x: svg.x + mark.x * scale + 3,
    y: svg.y + mark.y * scale + 5,
  };
  await page.mouse.move(pointer.x, pointer.y);
  await expect
    .poll(async () => Math.abs((await tooltip.boundingBox()).y - pointer.y))
    .toBeLessThan(2);
  await testInfo.attach('unclipped-tooltip', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
});

test('range and composition support keyboard tooltips and table twins', async ({
  page,
}) => {
  await open(page);
  await page.locator('#activity-range rect[tabindex]').first().focus();
  await expect(page.locator('#activity-range [role=tooltip]')).toBeVisible();
  for (const id of ['range', 'composition']) {
    const chart = page.locator(`#activity-${id}`);
    await chart.locator('.ui-chart-canvas').focus();
    await page.keyboard.press('ArrowRight');
    await expect(chart.locator('[role="tooltip"]')).toBeVisible();
    await page.keyboard.press('End');
    await expect(chart.locator('.ui-chart-live')).not.toBeEmpty();
    await chart.getByRole('button', { name: 'Show data table' }).click();
    await expect(chart.locator('table')).toBeVisible();
  }
});
