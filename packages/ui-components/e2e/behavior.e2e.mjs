/**
 * Behaviour state machines in a real browser (Chromium and WebKit): the
 * toggle and disclosure reference machines driven by the keyboard only,
 * with WCAG 2.2 A/AA checks in every state. The screenshot is attached to
 * the test report.
 */
import { expect, test } from '@playwright/test';

import { expectAccessible } from '../../../tests/ui/helpers.mjs';

const PAGE = 'packages/ui-components/e2e/pages/behavior.html';

/** Tab until the element with the accessible name has focus. */
async function tabTo(page, locator) {
  for (let i = 0; i < 10; i += 1) {
    if (await locator.evaluate((node) => node === document.activeElement)) {
      return;
    }
    await page.keyboard.press('Tab');
  }
  await expect(locator).toBeFocused();
}

test.describe('ui-components behaviour', () => {
  test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(PAGE);
    await expect(page.locator('#app[data-ready="true"]')).toBeAttached();
    await expect(page.locator('#diagnostics')).toHaveText('none');
    expect(errors).toEqual([]);
  });

  test('toggle: Enter and Space switch aria-pressed', async ({ page }) => {
    const bold = page.getByRole('button', { name: 'Bold' });
    await expect(bold).toHaveAttribute('aria-pressed', 'false');
    await expectAccessible(page);
    await tabTo(page, bold);
    await page.keyboard.press('Enter');
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
    await expect(bold).toBeFocused();
    await expectAccessible(page);
    await page.keyboard.press('Space');
    await expect(bold).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Space');
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
  });

  test('disclosure: open moves focus in, Escape closes and restores focus', async ({
    page,
  }, testInfo) => {
    const trigger = page.getByRole('button', { name: 'Details' });
    const panel = page.locator('[data-link-id="panel"]');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
    await tabTo(page, trigger);
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await expect(panel).toBeFocused();
    await expect(panel).toHaveText(/Hidden details/);
    await expectAccessible(page);
    await testInfo.attach('behavior-open', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // closing → closed after 500ms
    await expect(panel).toBeHidden();
    await expect(panel).toHaveAttribute('data-state', 'closed');
    await expectAccessible(page);
    // Space opens it again.
    await page.keyboard.press('Space');
    await expect(panel).toBeVisible();
    await expect(panel).toBeFocused();
  });
});
