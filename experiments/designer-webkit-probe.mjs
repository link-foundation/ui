/** Reproduce CI's Outline contrast and expanded-container drop in local WebKit. */
import assert from 'node:assert/strict';
import { webkit } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';

const before = process.argv.includes('--before');
const browser = await webkit.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto(
      'http://127.0.0.1:4173/packages/ui-designer/examples/index.html'
    );
    await page.locator('.designer-canvas [data-link-id=ok]').click();
    await page.getByRole('tab', { name: 'Outline', exact: true }).click();
    const source = page.getByRole('textbox', {
      name: 'LiNo source',
      exact: true,
    });
    await source.fill(`${await source.inputValue()}\n(`);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    console.log(colorScheme, JSON.stringify(violations));
    if (colorScheme === 'light') {
      await page.screenshot({
        path: `docs/screenshots/designer/outline-${before ? 'before' : 'after'}.png`,
      });
    }
    if (!before) {
      assert.deepEqual(violations, []);
    }
  }
  await page.reload();
  await page.getByRole('tab', { name: 'Outline', exact: true }).click();
  const row = (id) =>
    page.locator(`[role=treeitem][data-id="${id}"] > .outline-row`);
  const from = await row('greeting').boundingBox();
  const to = await row('details').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  const parent = await page.evaluate(() =>
    globalThis.designer.store.parentOf('greeting')
  );
  console.log('Dropped greeting parent:', parent);
  if (!before) {
    assert.equal(parent, 'details');
  }
} finally {
  await browser.close();
}
