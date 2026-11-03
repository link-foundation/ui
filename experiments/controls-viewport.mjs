// Does the controls page height depend on the viewport height? A
// full-page screenshot resizes the viewport to the page height, so it must
// not. Prints the page height and the elements whose box changes.
/* global document, window */
import { chromium } from '@playwright/test';
import { startStaticServer } from '../scripts/lib/static-server.mjs';
import { defaultMounts } from '../scripts/serve-static.mjs';

const server = await startStaticServer({
  mounts: defaultMounts(process.cwd()),
});
const browser = await chromium.launch(
  process.env.CHROME ? { executablePath: process.env.CHROME } : {}
);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${server.url}packages/ui-components/e2e/pages/controls.html`);
await page.locator('#app[data-ready="true"]').waitFor({ state: 'attached' });
await page.waitForTimeout(500);
const boxes = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('body *')].map((n, i) => {
      const r = n.getBoundingClientRect();
      return [
        `${i}:${n.localName}#${n.id}`,
        `${r.top + window.scrollY}/${r.height}`,
      ];
    })
  );
const measure = async (height) => {
  await page.setViewportSize({ width: 1280, height });
  await page.waitForTimeout(200);
  return {
    h: await page.evaluate(() => document.documentElement.scrollHeight),
    boxes: new Map(await boxes()),
  };
};
const a = await measure(720);
for (const height of [a.h, 1806, 400]) {
  const b = await measure(height);
  console.log(`viewport ${height}: page ${b.h} (720: ${a.h})`);
  let shown = 0;
  for (const [k, v] of b.boxes) {
    if (a.boxes.get(k) !== v && shown++ < 8) {
      console.log('  ', k, a.boxes.get(k), '->', v);
    }
  }
}
await browser.close();
await server.close();
