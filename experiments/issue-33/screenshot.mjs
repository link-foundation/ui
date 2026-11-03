/**
 * Screenshots of the behaviour e2e page (packages/ui-components/e2e/pages/
 * behavior.html) for the pull request: the initial state, the toggle on and
 * the disclosure open, driven by the keyboard only.
 *
 *   node experiments/issue-33/screenshot.mjs [outDir]
 */
import path from 'node:path';
import { URL } from 'node:url';
import { chromium } from '@playwright/test';
import { defaultMounts } from '../../scripts/serve-static.mjs';
import { startStaticServer } from '../../scripts/lib/static-server.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const outDir = path.resolve(process.argv[2] ?? 'docs/screenshots/issue-33');
const server = await startStaticServer({
  mounts: defaultMounts(root),
  port: 0,
});
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 420 } });
  await page.goto(
    new URL('packages/ui-components/e2e/pages/behavior.html', server.url).href
  );
  await page.waitForSelector('#app[data-ready="true"]');
  await page.screenshot({ path: path.join(outDir, 'behavior-initial.png') });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter'); // Bold: aria-pressed true
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter'); // Details: open, focus in the panel
  await page.waitForSelector('[data-link-id="panel"]:not([hidden])');
  await page.screenshot({ path: path.join(outDir, 'behavior-open.png') });
  console.log(`saved to ${outDir}`);
} finally {
  await browser.close();
  await server.close();
}
