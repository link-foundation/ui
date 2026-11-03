// Open the layout gallery in Chromium and print console messages, the
// diagnostics and a screenshot (experiments/out/). Needs the static server:
// node scripts/serve-static.mjs --port 4173
import { chromium } from '@playwright/test';

const width = Number(process.argv[2] ?? 1280);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 800 } });
page.on('console', (m) => console.log('console', m.type(), m.text()));
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(
  'http://127.0.0.1:4173/packages/ui-components/examples/layout.html'
);
await page.waitForSelector('#app[data-ready=true]', { timeout: 10000 });
console.log(
  'mode',
  await page.getAttribute('ui-app-shell', 'mode'),
  'tabs',
  await page.locator('[role=tab]').allTextContents()
);
await page.screenshot({
  path: `experiments/out/gallery-${width}.png`,
  fullPage: true,
});
await browser.close();
