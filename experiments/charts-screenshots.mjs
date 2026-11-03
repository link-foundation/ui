/**
 * Captures chart gallery screenshots into docs/screenshots/issue-39/: the gallery in light and dark, the sales
 * chart with a focused point and its tooltip, and with the table shown.
 *
 * Needs the static server (`node scripts/serve-static.mjs --port 4173`) and
 * a local Google Chrome: node experiments/charts-screenshots.mjs
 */
import { mkdirSync } from 'node:fs';
import { URL } from 'node:url';
import { chromium } from '@playwright/test';

const OUT = new URL('../docs/screenshots/issue-39/', import.meta.url);
const GALLERY =
  'http://127.0.0.1:4173/packages/ui-components/examples/charts.html';
mkdirSync(OUT, { recursive: true });
const file = (name) => new URL(name, OUT).pathname;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  reducedMotion: 'reduce',
  timezoneId: 'UTC',
  locale: 'en-US',
});
const open = async () => {
  await page.goto(GALLERY);
  await page.waitForSelector('#chart-arc svg[role="img"]');
  await page.waitForSelector('ui-sparkline svg');
};

await open();
await page.screenshot({ path: file('gallery-light.png'), fullPage: true });
await page.click('#theme');
await page.screenshot({ path: file('gallery-dark.png'), fullPage: true });

await open();
await page.focus('#chart-line .ui-chart-canvas');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
await page
  .locator('#chart-line')
  .screenshot({ path: file('sales-focused-point.png') });

await open();
await page.click('#chart-line button.ui-chart-toggle');
await page.locator('#chart-line').screenshot({ path: file('sales-table.png') });

await browser.close();
console.log('written to', OUT.pathname);
