/* global window, document */
import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
});
try {
  const page = await browser.newPage();
  await page.goto(
    'http://127.0.0.1:4173/packages/ui-components/examples/links-network.html'
  );
  await page.waitForFunction(() =>
    window.networkGallery?.views.every((el) => el.drawn)
  );
  const el = page.locator('#large links-network');
  await el.evaluate(async (el) => {
    el.items = Array.from({ length: 2001 }, (_, i) => ({
      id: i === 0 ? 'a' : `extra${i}`,
      source: 'p',
      target: 'q',
    }));
    await el.ready;
    el.positions = new Map([
      ['p', { x: 20, y: 80 }],
      ['a', { x: 120, y: 80 }],
      ['q', { x: 220, y: 80 }],
    ]);
    el.select('p');
  });
  await el.focus();
  console.log(
    'before',
    await el.evaluate((el) => ({
      selected: el.selection,
      positions: [...el.positions],
      focused: document.activeElement === el,
    }))
  );
  await page.keyboard.press('ArrowRight');
  console.log('after', await el.evaluate((el) => el.selection));
} finally {
  await browser.close();
}
