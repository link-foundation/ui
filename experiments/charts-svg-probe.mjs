// Prints the structure of the line chart's SVG in the gallery (local Chrome).
/* global document */
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(
  'http://127.0.0.1:4173/packages/ui-components/examples/charts.html'
);
await page.waitForSelector('#chart-line svg[role="img"]');
console.log(
  await page.evaluate(() => {
    const svg = document.querySelector('#chart-line svg[role="img"]');
    return [svg.namespaceURI, svg.children.length, svg.outerHTML.slice(0, 600)];
  })
);
await browser.close();
