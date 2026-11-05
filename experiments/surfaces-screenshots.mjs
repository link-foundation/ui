/**
 * Writes the gallery of the surfaces, chip, accordion and circular progress
 * to docs/screenshots/, in the pinned Playwright container:
 *   docker run --rm -v "$PWD":/work -w /work \
 *     mcr.microsoft.com/playwright:v1.59.1-noble \
 *     node experiments/surfaces-screenshots.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const server = spawn('node', ['scripts/serve-static.mjs'], { stdio: 'ignore' });
try {
  await delay(1000);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    reducedMotion: 'reduce',
  });
  await page.goto(
    'http://127.0.0.1:4173/packages/ui-components/e2e/pages/surfaces.html'
  );
  await page.waitForSelector('body[data-ready="true"]');
  await page.screenshot({
    path: 'docs/screenshots/issue-164-surfaces.png',
    fullPage: true,
  });
  await page
    .locator('#light')
    .getByRole('button', { name: 'Remove Ada' })
    .focus();
  await page.keyboard.press('Enter');
  await page
    .locator('#dark')
    .getByRole('button', { name: 'Shipping' })
    .press('Enter');
  await page.screenshot({
    path: 'docs/screenshots/issue-164-keyboard.png',
    fullPage: true,
  });
  await browser.close();
} finally {
  server.kill();
}
