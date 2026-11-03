/* global window, requestAnimationFrame */
import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: process.env.NETWORK_CHROME ?? '/opt/google/chrome/chrome',
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    reducedMotion: 'reduce',
  });
  await page.goto(
    'http://127.0.0.1:4173/packages/ui-components/examples/links-network.html'
  );
  await page.waitForFunction(() =>
    window.networkGallery?.views.every((el) => el.drawn)
  );
  await page.evaluate(() =>
    Promise.all(window.networkGallery.views.map((el) => el.ready))
  );
  await page.screenshot({
    path: 'docs/screenshots/links-network/gallery.png',
    fullPage: true,
  });
  const node = page.locator('#circle links-network');
  await node.evaluate((el) => el.select('l1'));
  const p = await node.evaluate((el) => {
    const p = el.positions.get('p1'),
      v = el.view;
    return { x: p.x * v.k + v.x, y: p.y * v.k + v.y };
  });
  const box = await node.boundingBox();
  await page.mouse.move(box.x + p.x, box.y + p.y);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.locator('#circle').screenshot({
    path: 'docs/screenshots/links-network/selected-neighbours.png',
  });
  await page.getByLabel('Theme').selectOption('dark');
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.screenshot({
    path: 'docs/screenshots/links-network/dark.png',
    fullPage: true,
  });
} finally {
  await browser.close();
}
