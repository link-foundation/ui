/* global window, document, matchMedia, requestAnimationFrame */
// Run with scripts/serve-static.mjs listening on port 4173.
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 320, height: 900 },
  reducedMotion: 'reduce',
});
page.on('pageerror', (error) => console.log('pageerror', error.message));
await page.goto(
  'http://127.0.0.1:4173/packages/ui-components/e2e/pages/page-layout.html'
);
await page.waitForFunction(() => window.pageLayout);
console.log(
  await page.evaluate(() => ({
    media: matchMedia('(prefers-reduced-motion: reduce)').matches,
    prefs: window.pageLayout.target.values(),
    html: document.documentElement.outerHTML.slice(0, 200),
    props: window.pageLayout.store.get('pages'),
    nav: [...document.querySelectorAll('nav')].map((n) => ({
      width: n.clientWidth,
      scroll: n.scrollWidth,
      more: n.dataset.more,
      links: n.innerHTML,
    })),
    rects: [
      ...document.querySelectorAll('ui-app-bar, ui-nav-strip, ui-stack'),
    ].map((n) => ({
      tag: n.localName,
      width: n.getBoundingClientRect().width,
    })),
  }))
);
if (process.argv.includes('--screenshots')) {
  const directory = 'docs/screenshots/issue-233';
  await mkdir(directory, { recursive: true });
  for (const [name, width, direction] of [
    ['mobile-ltr', 320, 'ltr'],
    ['mobile-rtl', 320, 'rtl'],
    ['desktop', 1200, 'ltr'],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async (dir) => {
      document.documentElement.dir = dir;
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    }, direction);
    await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
  }
}
await browser.close();
