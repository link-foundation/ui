// Reproducible review screenshots. Start scripts/serve-static.mjs on port 4173.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const directory = 'docs/case-studies/issue-231/screenshots';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const url =
    'http://127.0.0.1:4173/packages/ui-components/examples/settings-gallery.html';
  const original = execFileSync(
    'git',
    ['show', 'origin/main:packages/ui-components/src/controls/number-field.js'],
    { encoding: 'utf8' }
  );
  await page.route('**/src/controls/number-field.js', (route) =>
    route.fulfill({ body: original, contentType: 'text/javascript' })
  );
  await page.goto(url);
  await page.waitForSelector('settings-panel');
  await page.getByRole('tab', { name: 'Typography', exact: true }).click();
  await page.locator('[data-key=scale]').getByRole('spinbutton').fill('2');
  await page
    .locator('[data-key=scale]')
    .screenshot({ path: `${directory}/number-before.png` });
  await page.unroute('**/src/controls/number-field.js');
  await page.reload();
  await page.getByRole('tab', { name: 'Typography', exact: true }).click();
  await page
    .locator('[data-key=scale]')
    .screenshot({ path: `${directory}/number-after.png` });
  await page.evaluate(() => globalThis.window.panel.update({ scale: 1 }));
  await page.getByRole('tab', { name: 'Material', exact: true }).click();
  await page.getByRole('button', { name: 'Save look', exact: true }).click();
  await page.screenshot({ path: `${directory}/gallery.png`, fullPage: true });
  await page
    .locator('[data-key=accent]')
    .getByRole('button', { name: 'Accent', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Accent' })
    .getByRole('slider')
    .first()
    .waitFor({ state: 'visible' });
  await page.screenshot({ path: `${directory}/colour-popover.png` });
} finally {
  await browser.close();
}
