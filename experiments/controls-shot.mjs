// Screenshot the controls page in light and dark (for visual review).
/* global window */
import { chromium } from '@playwright/test';
const browser = await chromium.launch(
  process.env.CHROME ? { executablePath: process.env.CHROME } : {}
);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(
  'http://127.0.0.1:4173/packages/ui-components/e2e/pages/controls.html'
);
await page.waitForSelector('#app[data-ready="true"]');
const out = process.argv[2] ?? '/tmp';
for (const theme of ['light', 'dark']) {
  await page.evaluate((c) => window.setUi(c), { theme, locale: 'en' });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: `${out}/controls-${theme}.png`,
    fullPage: true,
  });
}
console.log('diagnostics:', await page.textContent('#diagnostics'));
console.log('errors:', errors);
await browser.close();
