/* global document */
// Serve the repository, open the link-view gallery in Chromium and save a
// screenshot of each colour scheme to experiments/issue-41/out/.
import { mkdirSync } from 'node:fs';
import { URL } from 'node:url';
import { chromium } from '@playwright/test';
import { defaultMounts } from '../../scripts/serve-static.mjs';
import { startStaticServer } from '../../scripts/lib/static-server.mjs';

const root = new URL('../../', import.meta.url).pathname;
const out = new URL('./out/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const server = await startStaticServer({
  mounts: defaultMounts(root),
  port: 0,
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({
      colorScheme: scheme,
      viewport: { width: 1280, height: 800 },
    });
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    page.on(
      'response',
      (r) => r.status() >= 400 && console.log(scheme, r.status(), r.url())
    );
    page.on('console', (m) => console.log(scheme, m.type(), m.text()));
    page.on('pageerror', (e) => console.log(scheme, 'pageerror', e.message));
    await page.goto(
      `${server.url}packages/ui-components/examples/link-view.html${process.argv[2] ?? ''}`
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll('link-view')].every((v) => v.drawn !== null)
    );
    console.log(
      scheme,
      await page.evaluate(() =>
        [...document.querySelectorAll('link-view')].map(
          (v) =>
            `${v.getAttribute('aria-label')} | ${v.dataset.markers} | ${v.drawn.renderer}`
        )
      )
    );
    console.log(
      'foreign requests:',
      requests.filter((u) => !u.startsWith(server.url))
    );
    await page.screenshot({
      path: `${out}gallery-${scheme}.png`,
      fullPage: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
