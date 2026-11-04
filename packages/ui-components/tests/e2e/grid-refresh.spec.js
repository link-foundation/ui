// Grid child refreshes must report callback failures, even when rendering succeeds.
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

test('grid children refresh without areas and stop refreshing after teardown', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('packages/ui-components/examples/layout.html');
  await page.locator('#app[data-ready=true]').waitFor();
  await page.evaluate(async () => {
    const { mountDocument } = await import('@link-foundation/ui-dom');
    const { layoutVocabulary } =
      await import('@link-foundation/ui-components/layout');
    const app = document.createElement('main');
    document.body.replaceChildren(app);
    window.gridTest = mountDocument(
      app,
      `g: grid
  columns 1fr
  a: text A`,
      { parseOptions: { vocabulary: layoutVocabulary() } }
    );
  });
  const child = page.locator('[data-link-id=a]');
  await expect(child).toHaveText('A');
  await expect(child).not.toHaveAttribute('data-grid-area');
  await page.evaluate(() => {
    const { store } = window.gridTest;
    store.insert('g', 1, { id: 'b', kind: 'text', positional: ['B'] });
    store.remove('a');
    store.setProp('g', 'columns', ['2']);
  });
  const grid = page.locator('ui-grid');
  await expect(grid).toHaveText('B');
  await expect(grid.locator('[data-link-id=b]')).not.toHaveAttribute(
    'data-grid-area'
  );
  await page.evaluate(() => window.gridTest.store.setProp('g', 'areas', ['b']));
  await expect(grid.locator('[data-link-id=b]')).toHaveCSS('grid-area', 'b');
  await page.evaluate(() => window.gridTest.store.removeProp('g', 'areas'));
  await expect(grid.locator('[data-link-id=b]')).not.toHaveAttribute(
    'data-grid-area'
  );
  await expectAccessible(page);
  if (
    process.env.GRID_DOCS_SCREENSHOTS &&
    testInfo.project.name === 'chromium'
  ) {
    await page.screenshot({
      path: join(
        import.meta.dirname,
        '../../../../docs/screenshots/issue-148/after.png'
      ),
    });
  }
  await page.evaluate(async () => {
    const { store, handle } = window.gridTest;
    store.setProp('g', 'areas', ['b c']);
    handle.flush();
    const grid = handle.nodeFor('g');
    const child = document.createElement('ui-text');
    child.setAttribute('data-link-id', 'c');
    grid.appendChild(child);
    await Promise.resolve();
    handle.destroy();
    window.destroyedGridChild = child;
  });
  expect(
    await page.evaluate(() => window.destroyedGridChild.style.gridArea)
  ).toBe('');
  expect(errors).toEqual([]);
});
