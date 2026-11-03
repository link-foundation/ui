import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { expectAccessible } from '../../../tests/ui/helpers.mjs';

const PAGE = 'packages/ui-devmode/examples/?ui-dev';
const dialog = (page) => page.locator('ui-defaults-dialog').getByRole('dialog');

async function editAndOpen(page, value = 'Shared hello') {
  await page.goto(PAGE);
  await page.waitForFunction(() => globalThis.linkUiDevMode);
  await page.evaluate(() => globalThis.linkUiDevMode.select('ok'));
  const inspector = page.locator('ui-devmode-inspector');
  await inspector.getByRole('tab', { name: 'Properties' }).click();
  await inspector
    .locator('tr[data-name="label"]')
    .getByRole('textbox', { name: 'label', exact: true })
    .fill(value);
  await inspector
    .getByRole('button', { name: 'Make these the defaults' })
    .click();
  await expect(dialog(page)).toBeVisible();
}

test('edit label, copy share link, preview on a new page, discard and keep', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value) => {
          globalThis.copiedShare = value;
        },
      },
    });
  });
  await editAndOpen(page);
  await expect(
    dialog(page).getByText('1 changes', { exact: true })
  ).toBeVisible();
  await dialog(page)
    .getByRole('button', { name: 'Copy Share link', exact: true })
    .click();
  const url = await page.evaluate(() => globalThis.copiedShare);
  const preview = await context.newPage();
  await preview.goto(url);
  const banner = preview.getByRole('complementary', {
    name: 'Shared UI changes are previewed.',
  });
  await expect(banner).toBeVisible();
  await expect(preview.locator('#app [data-link-id="ok"] button')).toHaveText(
    'Shared hello'
  );
  expect(new globalThis.URL(preview.url()).hash).toBe('');
  const backup = await preview.evaluate(() =>
    globalThis.localStorage.getItem('ui-overrides:before-the-link')
  );
  expect(backup).toContain("name 'Before the link'");
  await banner.getByRole('button', { name: 'Discard' }).click();
  await expect(preview.locator('#app [data-link-id="ok"] button')).toHaveText(
    'OK'
  );
  await preview.goto('about:blank');
  await preview.goto(url);
  await banner.getByRole('button', { name: 'Keep' }).click();
  await expect(banner).toHaveCount(0);
  await expect(preview.locator('#app [data-link-id="ok"] button')).toHaveText(
    'Shared hello'
  );
  await preview.close();
});

test('modal passes axe, traps focus, selects text on clipboard failure, and restores focus', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('blocked');
        },
      },
    });
  });
  await editAndOpen(page);
  const modal = dialog(page);
  await expectAccessible(page, { include: 'ui-defaults-dialog' });
  await modal.getByRole('button', { name: 'Copy Overrides as LiNo' }).click();
  const text = modal.getByRole('textbox', { name: 'Overrides as LiNo' });
  await expect(text).toBeFocused();
  expect(await text.evaluate((el) => el.selectionEnd - el.selectionStart)).toBe(
    (await text.inputValue()).length
  );
  const instruction = await modal
    .getByRole('textbox', { name: 'Agent instruction' })
    .inputValue();
  expect(instruction).toContain('link-foundation/ui');
  expect(instruction).toContain('site/config/site.lino');
  await modal.getByRole('button', { name: 'Close dialog' }).focus();
  await page.keyboard.press('Tab');
  await expect(modal.getByRole('textbox').first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    modal.getByRole('button', { name: 'Close dialog' })
  ).toBeFocused();
  const shot = await page.screenshot();
  await testInfo.attach('defaults-dialog', {
    body: shot,
    contentType: 'image/png',
  });
  if (
    process.env.UPDATE_DOCS_SCREENSHOTS === '1' &&
    testInfo.project.name === 'chromium'
  ) {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.screenshot({ path: 'docs/screenshots/ui-devmode-defaults.png' });
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page, { include: 'ui-defaults-dialog' });
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(
    page
      .locator('ui-devmode-inspector')
      .getByRole('button', { name: 'Make these the defaults' })
  ).toBeFocused();
});

test('oversize share link disables copy and offers LiNo instead', async ({
  page,
}) => {
  await editAndOpen(page, 'x'.repeat(9000));
  await expect(
    dialog(page).getByRole('button', { name: 'Copy Share link', exact: true })
  ).toBeDisabled();
  await expect(
    dialog(page).getByText(
      'Share link exceeds 8,192 characters. Copy the LiNo text instead.'
    )
  ).toBeVisible();
  await expect(
    dialog(page).getByRole('link', { name: 'Open as GitHub issue' })
  ).toHaveCount(0);
});
