// Print the ARIA snapshot of the controls page (for writing e2e locators).
/* global window */
import { chromium } from '@playwright/test';
const browser = await chromium.launch(
  process.env.CHROME ? { executablePath: process.env.CHROME } : {}
);
const page = await browser.newPage();
await page.goto(
  'http://127.0.0.1:4173/packages/ui-components/e2e/pages/controls.html'
);
await page.waitForSelector('#app[data-ready="true"]');
if (process.argv[2]) {
  await page.evaluate((c) => window.setUi(c), {
    theme: 'light',
    locale: process.argv[2],
  });
}
console.log(await page.locator('main').ariaSnapshot());
await browser.close();
