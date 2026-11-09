/* global URL, document */
/** Capture the original framework example with a temporary local static server. */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { defaultMounts } from '../scripts/serve-static.mjs';
import { startStaticServer } from '../scripts/lib/static-server.mjs';
const output = new URL('../docs/screenshots/issue-229/', import.meta.url);
await mkdir(output, { recursive: true });
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await startStaticServer({ mounts: defaultMounts(root) });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 1000 },
    reducedMotion: 'reduce',
  });
  await page.goto(
    `${server.url}packages/ui-components/examples/links-gallery.html`
  );
  for (const [locale, theme, classes, real] of [
    ['en', 'light', false, false],
    ['ru', 'dark', true, true],
  ]) {
    await page.emulateMedia({ colorScheme: theme });
    await page.locator('links-gallery').evaluate(
      (el, options) => {
        el.setAttribute('lang', options.locale);
        el.setAttribute('theme', options.theme);
        el.toggleAttribute('classes', options.classes);
        el.toggleAttribute('real', options.real);
      },
      { locale, theme, classes, real }
    );
    await page.waitForFunction(() =>
      [
        ...document
          .querySelector('links-gallery')
          .shadowRoot.querySelectorAll('links-gallery-network'),
      ].every((node) => node.drawn)
    );
    await page.screenshot({
      path: new URL(`${locale}-${theme}.png`, output).pathname,
      fullPage: true,
    });
  }
} finally {
  await browser.close();
  await server.close();
}
