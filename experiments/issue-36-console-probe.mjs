// Prints console errors and page errors of a served page (local debugging).
// Usage: node experiments/issue-36-console-probe.mjs <path>  (server on 4173)
import { chromium } from '@playwright/test';

const path =
  process.argv[2] ?? 'packages/ui-components/e2e/pages/behavior.html';
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
});
const page = await browser.newPage();
page.on(
  'console',
  (m) => m.type() === 'error' && console.log('console:', m.text())
);
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('requestfailed', (r) => console.log('failed:', r.url()));
page.on(
  'response',
  (r) => r.status() >= 400 && console.log(r.status(), r.url())
);
await page.goto(`http://127.0.0.1:4173/${path}`);
await page.waitForTimeout(1500);
console.log('ready:', await page.locator('#app').getAttribute('data-ready'));
await browser.close();
