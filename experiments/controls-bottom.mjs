// The elements whose box reaches the bottom of the controls page.
/* global document, window, getComputedStyle */
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
await page.goto(`${server.url}packages/ui-components/e2e/pages/controls.html`);
await page.waitForSelector('#app[data-ready="true"]');
await page.evaluate(() => document.fonts.ready);
const report = () =>
  page.evaluate(() => {
    const out = [`scrollHeight ${document.documentElement.scrollHeight}`];
    for (const node of document.querySelectorAll('body *')) {
      const box = node.getBoundingClientRect();
      if (
        box.bottom + window.scrollY >
        document.documentElement.scrollHeight - 80
      ) {
        out.push(
          `${node.localName}${node.id ? `#${node.id}` : ''}[${node.dataset.part ?? ''}] ${Math.round(box.top)}-${Math.round(box.bottom)} ${getComputedStyle(node).position}`
        );
      }
    }
    return out.join('\n');
  });
console.log(await report());
// As the screenshot test does: remount for a theme × locale cell.
await page.evaluate(() => window.setUi({ theme: 'light', locale: 'en' }));
await page.waitForTimeout(300);
console.log(`after setUi\n${await report()}`);
await browser.close();
await server.close();
