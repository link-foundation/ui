// Screenshots of examples/ui-dom/ in Chromium for the pull request:
// docs/screenshots/ui-dom-example.png (first render) and
// docs/screenshots/ui-dom-example-after.png (after OK and "Change greeting").
// Usage: node experiments/ui-dom-screenshot.mjs [chromium executable]
import { URL, fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { defaultMounts } from '../scripts/serve-static.mjs';
import { startStaticServer } from '../scripts/lib/static-server.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await startStaticServer({
  mounts: defaultMounts(root),
  port: 0,
});
const browser = await chromium.launch({ executablePath: process.argv[2] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 420 } });
  await page.goto(`${server.url}examples/ui-dom/`);
  await page.locator('#app[data-ready="true"]').waitFor({ state: 'attached' });
  await page.screenshot({ path: `${root}docs/screenshots/ui-dom-example.png` });
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'Change greeting' }).click();
  await page.getByText('Hello again, links').waitFor();
  await page.screenshot({
    path: `${root}docs/screenshots/ui-dom-example-after.png`,
  });
  console.log(await page.locator('#app').innerHTML());
} finally {
  await browser.close();
  await server.close();
}
