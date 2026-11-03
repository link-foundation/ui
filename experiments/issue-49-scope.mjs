/* global document, getComputedStyle, CSSStyleSheet */
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  await page.setContent(`<style>
  button { color: red }
  @scope ([data-theme]) to (:scope [data-theme]) {
    :where([data-theme]) button { color: green }
  }
  </style><div data-theme="fluent2"><button>Test</button></div>`);
  console.log(
    await page.locator('button').evaluate((el) => getComputedStyle(el).color)
  );
  await page.goto('http://localhost:4173/examples/themes/fluent2.html');
  await page.waitForSelector('body[data-ready]');
  console.log(
    await page.evaluate(() => {
      const el = document.querySelector(
        '#dark ui-button[variant="outlined"] button'
      );
      const before = getComputedStyle(el).color;
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(
        '@scope ([data-theme]) to (:scope [data-theme]) { :scope ui-button [data-part="root"] { color: lime; } }'
      );
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      return { before, after: getComputedStyle(el).color };
    })
  );
} finally {
  await browser.close();
}
