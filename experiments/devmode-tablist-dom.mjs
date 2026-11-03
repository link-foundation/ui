// Dump the tab list of the inspector in Chromium (axe nested-interactive).
// Needs `node scripts/serve-static.mjs --port 4173` running.
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4173/packages/ui-devmode/examples/?ui-dev');
await page.waitForSelector('ui-devmode-inspector');
await page.waitForTimeout(300);
console.log(
  await page.evaluate(() => {
    const shadow = document.querySelector('ui-devmode-inspector').shadowRoot;
    const tab = shadow.querySelector('#devmode-tab-outline');
    return [
      tab.outerHTML,
      tab.parentElement.outerHTML.slice(0, 300),
      tab.parentElement.parentElement.tagName,
      [...tab.parentElement.parentElement.children]
        .map(
          (c) =>
            c.tagName + '.' + c.className + '[' + c.getAttribute('role') + ']'
        )
        .join(' '),
    ].join('\n---\n');
  })
);
await browser.close();
