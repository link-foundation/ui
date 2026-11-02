/**
 * The ui-dom example page (examples/ui-dom/) in a real browser: the sample
 * document renders as custom elements with `data-link-id`, the adopted
 * stylesheet gives the filled button the token colour, the OK button
 * dispatches its action as data, and the greeting changes through the store.
 * The screenshot is attached to the test report.
 */
import { expect, test } from '@playwright/test';

import { expectAccessible } from '../../../tests/ui/helpers.mjs';

test.describe('ui-dom example', () => {
  test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('examples/ui-dom/');
    await expect(page.locator('#app[data-ready="true"]')).toBeAttached();
    expect(errors).toEqual([]);
  });

  test('renders the sample with data-link-id and takes a screenshot', async ({
    page,
  }, testInfo) => {
    const ok = page.locator('[data-link-id="ok"]');
    await expect(ok).toBeVisible();
    await expect(
      page.locator(
        'ui-document[data-link-id="app"] > ui-stack[data-link-id="body"] > ui-text[data-link-id="greeting"]'
      )
    ).toHaveText('Hello, links');
    // ui-button[variant='filled'] { background-color: var(--color-primary) }
    // with color.primary '#6750A4' of tokens.lino.
    await expect(ok).toHaveCSS('background-color', 'rgb(103, 80, 164)');
    await expect(ok).toHaveCSS('color', 'rgb(255, 255, 255)');
    await testInfo.attach('ui-dom-example', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('dispatches the press action and patches the greeting', async ({
    page,
  }) => {
    const greeting = page.locator('[data-link-id="greeting"]');
    await greeting.evaluate((node) => {
      window.greetingNode = node;
    });
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('#action')).toHaveText(
      'ok press → (navigate home)'
    );
    await page.getByRole('button', { name: 'OK' }).press('Enter');
    await expect(page.locator('#action')).toHaveText(
      'ok press → (navigate home)'
    );
    await page.getByRole('button', { name: 'Change greeting' }).click();
    await expect(greeting).toHaveText('Hello again, links');
    // The same node, patched in place.
    expect(
      await greeting.evaluate((node) => node === window.greetingNode)
    ).toBe(true);
  });

  test('is accessible', async ({ page }) => {
    await expectAccessible(page);
  });
});
