// Lists the gallery's failed requests (local Chrome).
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.on(
  'response',
  (r) => r.status() >= 400 && console.log(r.status(), r.url())
);
await page.goto(
  'http://127.0.0.1:4173/packages/ui-components/examples/charts.html'
);
await page.waitForTimeout(1500);
await browser.close();
