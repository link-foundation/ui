// Watch the height of the controls page right after load: which element
// grows, and when (a full-page screenshot needs a stable height).
/* global window, document, performance, requestAnimationFrame */
import { chromium } from '@playwright/test';
import { startStaticServer } from '../scripts/lib/static-server.mjs';
import { defaultMounts } from '../scripts/serve-static.mjs';

const server = await startStaticServer({
  mounts: defaultMounts(process.cwd()),
});
const browser = await chromium.launch(
  process.env.CHROME ? { executablePath: process.env.CHROME } : {}
);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  window.heights = [];
  const sample = () => {
    const rows = [
      ...document.querySelectorAll(
        '#stories ui-document > *, #app ui-document > *'
      ),
    ].map(
      (n) =>
        `${n.id || n.localName}:${Math.round(n.getBoundingClientRect().height)}`
    );
    window.heights.push([
      Math.round(performance.now()),
      document.documentElement.scrollHeight,
      rows.join(' '),
    ]);
  };
  const tick = () => {
    sample();
    if (performance.now() < 4000) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
});
await page.goto(`${server.url}packages/ui-components/e2e/pages/controls.html`);
await page.waitForTimeout(4500);
const heights = await page.evaluate(() => window.heights);
let last = null;
for (const [t, h, rows] of heights) {
  if (last === null || last[1] !== h) {
    console.log(t, h);
    if (last) {
      const before = new Map(last[2].split(' ').map((s) => s.split(':')));
      console.log(
        '  changed:',
        rows
          .split(' ')
          .filter((s) => {
            const [k, v] = s.split(':');
            return before.get(k) !== v;
          })
          .join(' ')
      );
    }
  }
  last = [t, h, rows];
}
await browser.close();
await server.close();
