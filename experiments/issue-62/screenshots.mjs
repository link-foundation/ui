/** Capture the site after building it and running scripts/serve-static.mjs. */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const output = new globalThis.URL(
  '../../docs/screenshots/site/',
  import.meta.url
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SITE_CHROME_PATH,
});
try {
  for (const language of ['en', 'ru']) {
    for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({
        colorScheme,
        viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        await page.goto(
          `http://127.0.0.1:4173/packages/site/dist/${language}/`
        );
        await page.locator('body[data-ready="true"]').waitFor();
        await page.screenshot({
          path: new globalThis.URL(`${language}-${colorScheme}.png`, output)
            .pathname,
          fullPage: true,
        });
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
