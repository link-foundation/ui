import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const example = '/packages/ui-components/examples/settings.html';
const row = (page, key) => page.locator(`.settings-row[data-key="${key}"]`);
const changes = (page) =>
  page.getByRole('textbox', { name: 'Your changes', exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto(example);
  await expect(page.locator('settings-panel')).toBeVisible();
});

test('control changes, live count, resets and a LiNo diff round trip', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await row(page, 'liquid.blur').getByRole('spinbutton').fill('24');
  await row(page, 'liquid.blur').getByRole('spinbutton').press('Tab');
  await row(page, 'theme.mode').getByRole('combobox').click();
  await page.getByRole('option', { name: 'dark', exact: true }).click();
  await row(page, 'motion.reduce').getByRole('switch').click();
  await expect(page.locator('[aria-live=polite]')).toHaveText(
    '3 changed settings'
  );
  await expect(row(page, 'liquid.blur')).toHaveAttribute('data-changed', '');
  const diff = await changes(page).inputValue();
  expect(diff).toContain('liquid.blur 24');
  expect(diff).not.toContain('accent');
  await page.reload();
  await expect(page.locator('[aria-live=polite]')).toHaveText(
    '0 changed settings'
  );
  await changes(page).fill(diff);
  await page
    .getByRole('button', { name: 'Paste changes', exact: true })
    .click();
  await expect(page.locator('[aria-live=polite]')).toHaveText(
    '3 changed settings'
  );
  await expect(row(page, 'liquid.blur').getByRole('spinbutton')).toHaveValue(
    '24'
  );
  await page.getByRole('button', { name: 'Reset Blur', exact: true }).click();
  await expect(row(page, 'liquid.blur').getByRole('spinbutton')).toHaveValue(
    '18'
  );
  await expect(row(page, 'liquid.blur')).not.toHaveAttribute('data-changed');
  expect(errors).toEqual([]);
});

test('search, section reset, presets, randomize, peek and confirmed global reset', async ({
  page,
}) => {
  await page
    .getByRole('combobox', { name: 'Preset', exact: true })
    .selectOption('calm');
  await expect(page.locator('[aria-live=polite]')).toHaveText(
    '2 changed settings'
  );
  await page.getByRole('searchbox').fill('Blur');
  await expect(page.locator('.settings-row:visible')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Reset Appearance', exact: true })
    .click();
  await expect(page.locator('[aria-live=polite]')).toHaveText(
    '0 changed settings'
  );
  await page.getByRole('searchbox').fill('');
  await page.evaluate(() => window.panel.update({ 'liquid.blur': 30 }));
  const peek = page.getByRole('button', { name: 'Peek defaults', exact: true });
  await peek.focus();
  await page.keyboard.down('Space');
  await expect(row(page, 'liquid.blur').getByRole('spinbutton')).toHaveValue(
    '18'
  );
  await page.keyboard.up('Space');
  await expect(row(page, 'liquid.blur').getByRole('spinbutton')).toHaveValue(
    '30'
  );
  await page.getByRole('button', { name: 'Randomize', exact: true }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page
    .getByRole('button', { name: 'Reset everything', exact: true })
    .click();
  await expect(page.locator('[aria-live=polite]')).not.toHaveText(
    '0 changed settings'
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Reset everything', exact: true })
    .click();
  await expect(page.locator('[aria-live=polite]')).toHaveText(
    '0 changed settings'
  );
});

test('clipboard fallback shares a link and invalid paste does not apply', async ({
  page,
}) => {
  await page.evaluate(() =>
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
  );
  await page.evaluate(() => window.panel.update({ 'liquid.blur': 24 }));
  await page
    .getByRole('button', { name: 'Copy share link', exact: true })
    .click();
  const fallback = page.getByRole('textbox', {
    name: 'Copy text',
    exact: true,
  });
  await expect(fallback).toBeVisible();
  const url = await fallback.inputValue();
  expect(url).toContain('#settings=');
  await page.goto(url);
  await expect(row(page, 'liquid.blur').getByRole('spinbutton')).toHaveValue(
    '24'
  );
  await changes(page).fill('settings\n  motion.reduce invalid');
  await page
    .getByRole('button', { name: 'Paste changes', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Invalid settings' })
  ).toBeVisible();
  await expect(row(page, 'liquid.blur').getByRole('spinbutton')).toHaveValue(
    '24'
  );
});

test('all example controls change their actual rendered preview', async ({
  page,
}) => {
  const preview = page.locator('#preview');
  await row(page, 'accent').locator('input[type=color]').fill('#224488');
  await expect(preview).toHaveCSS('border-top-color', 'rgb(34, 68, 136)');
  await row(page, 'title').getByRole('textbox').fill('New title');
  await row(page, 'title').getByRole('textbox').press('Tab');
  await expect(preview).toHaveAttribute('data-title', 'New title');
  await row(page, 'scale').getByRole('spinbutton').fill('2');
  await row(page, 'scale').getByRole('spinbutton').press('Tab');
  await expect(preview.locator('.sample')).toHaveCSS('font-size', '32px');
  await row(page, 'offset').getByRole('spinbutton').first().fill('4');
  await row(page, 'offset').getByRole('spinbutton').first().press('Tab');
  await expect(preview).toHaveAttribute('data-offset', '4 0');
  await row(page, 'tags').getByRole('textbox').fill('new');
  await row(page, 'tags').getByRole('button', { name: 'Add Tags' }).click();
  await expect(preview).toHaveAttribute('data-tags', 'sample new');
  await row(page, 'tags')
    .getByRole('button', { name: 'Remove sample' })
    .click();
  await expect(preview).toHaveAttribute('data-tags', 'new');
});

for (const mode of ['page', 'drawer']) {
  test(`axe audit in ${mode} mode and drawer focus return`, async ({
    page,
  }) => {
    if (mode === 'drawer') {
      await page.goto(`${example}?drawer`);
      await page.getByRole('button', { name: 'Open settings drawer' }).click();
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    if (mode === 'drawer') {
      await page.keyboard.press('Escape');
      await expect(page.locator('settings-panel')).toBeHidden();
      await expect(
        page.getByRole('button', { name: 'Open settings drawer' })
      ).toBeFocused();
    }
  });
}

test('narrow drawer fits the viewport and Escape works from the preview', async ({
  page,
}) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto(`${example}?drawer`);
  await page.getByRole('button', { name: 'Open settings drawer' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    400
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.evaluate(() => {
    const preview = document.querySelector('#preview');
    preview.tabIndex = 0;
    preview.focus();
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('settings-panel')).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Open settings drawer' })
  ).toBeFocused();
});
