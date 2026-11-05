import { test, expect } from '@playwright/test';
import { expectAccessible } from '../ui/helpers.mjs';

for (const fallback of [false, true]) {
  test(`select contracts in clipped labels; fallback=${fallback}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 320 });
    await page.goto(
      `/packages/ui-components/examples/control-contracts.html${fallback ? '?fallback' : ''}`
    );
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const input = page.getByRole('combobox', { name: 'Palette', exact: true });
    // Hidden option text must not become part of the enclosing label's name.
    await expect(page.getByLabel('Palette', { exact: true })).toHaveCount(1);
    await input.click();
    await expect(input).toBeFocused();
    const list = page.getByRole('listbox', {
      name: 'Options: Palette',
      exact: true,
    });
    await expect(list.getByRole('option')).toHaveCount(12);
    await expect
      .poll(async () => {
        const b = await list.boundingBox();
        return b && b.y >= 7 && b.y + b.height <= 313 && b.width >= 280;
      })
      .toBe(true);
    await list
      .getByRole('option', { name: 'Palette 1', exact: true })
      .click({ force: true });
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await input.press('PageDown');
    await expect(input).toHaveAttribute('aria-activedescendant', /p11-option$/);
    await input.press('Tab');
    await expect(page.locator('#next')).toBeFocused();
    await expect(input).toHaveText(/Palette 11/);
    await input.click();
    await page.setViewportSize({ width: 300, height: 260 });
    await expect
      .poll(async () => {
        const b = await list.boundingBox();
        return (
          b &&
          b.x >= 7 &&
          b.y >= 7 &&
          b.x + b.width <= 293 &&
          b.y + b.height <= 253
        );
      })
      .toBe(true);
    await input.press('Escape');
    await expect(page.getByLabel('Palette', { exact: true })).toHaveCount(1);
    await expectAccessible(page);
    await page.evaluate(() => {
      globalThis.mounted.destroy();
      globalThis.editors.destroy();
    });
    await expect(page.locator('[data-list-portal]')).toHaveCount(0);
  });
}

test('live number drafts, native text keys and keyboard palette editing', async ({
  page,
}) => {
  await page.goto('/packages/ui-components/examples/control-contracts.html');
  const number = page.getByRole('spinbutton', { name: 'Size', exact: true });
  await number.fill('1.');
  await expect(number).toHaveValue('1.');
  await number.press('End');
  await expect(number).toHaveValue('1.');
  await number.fill('');
  await page.getByRole('button', { name: 'Increase', exact: true }).click();
  await expect(number).toHaveValue('5.1');
  await page
    .getByRole('textbox', { name: 'Accent', exact: true })
    .fill('rgb(18, 86, 171)');
  await expect(
    page.getByRole('textbox', { name: 'Accent', exact: true })
  ).toHaveValue('#1256ab');
  await page.getByRole('button', { name: 'Sand', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('textbox', { name: 'Accent', exact: true })
  ).toHaveValue('#eecbaa');
});

test('rich panel conditions, whole-section columns and transparent previews', async ({
  page,
}) => {
  await page.goto('/packages/ui-components/examples/rich-settings.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const sections = page.locator('.settings-sections > details');
  const first = await sections.nth(0).boundingBox();
  const second = await sections.nth(1).boundingBox();
  expect(second.x).toBeGreaterThan(first.x + first.width);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(page.locator('[data-key=radius]')).toBeHidden();
  await expect(page.locator('[data-key=width]')).toBeVisible();
  await page.getByRole('button', { name: 'Shape', exact: true }).click();
  await page.getByRole('switch', { name: 'Show frame', exact: true }).click();
  await expect(page.locator('[data-key=radius]')).toBeHidden();
  await page.getByRole('switch', { name: 'Show frame', exact: true }).click();
  await expect(page.locator('.frame-preview')).toBeVisible();
  await expectAccessible(page);
  await page.setViewportSize({ width: 390, height: 800 });
  const narrowFirst = await sections.nth(0).boundingBox();
  const narrowSecond = await sections.nth(1).boundingBox();
  expect(narrowSecond.y).toBeGreaterThanOrEqual(
    narrowFirst.y + narrowFirst.height
  );
  await page.evaluate(() => globalThis.panel.destroy());
});
