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
  await page.getByRole('button', { name: 'Sand #eecbaa', exact: true }).focus();
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
  await page.getByRole('tab', { name: 'Fit', exact: true }).click();
  await expect(page.locator('[data-key=radius]')).toBeHidden();
  await expect(page.locator('[data-key=width]')).toBeVisible();
  await page.getByRole('tab', { name: 'Shape', exact: true }).click();
  await page.getByRole('switch', { name: 'Show frame', exact: true }).click();
  await expect(page.locator('[data-key=radius]')).toBeHidden();
  await expect(
    page.getByRole('tab', { name: 'Shape', exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole('tab', { name: 'Fit', exact: true })
  ).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('switch', { name: 'Show frame', exact: true }).click();
  await page.getByRole('tab', { name: 'Shape', exact: true }).click();
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

test('panel clipboard and file actions round-trip changes and reject invalid files', async ({
  page,
}) => {
  await page.goto('/packages/ui-components/examples/rich-settings.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text) => (globalThis.copiedSettings = text) },
    });
  });
  await page.getByRole('button', { name: 'Copy changes', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Copied' })
  ).toBeVisible();
  const copied = await page.evaluate(() => globalThis.copiedSettings);
  expect(copied).toContain('radius 18');
  const downloadEvent = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export settings', exact: true })
    .click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('settings.lino');
  const chunks = [];
  for await (const chunk of await download.createReadStream()) {
    chunks.push(chunk);
  }
  expect(Buffer.concat(chunks).toString()).toBe(copied);
  const file = page.getByLabel('Import settings', { exact: true });
  await file.setInputFiles({
    name: 'settings.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"radius":7}'),
  });
  await expect(
    page.getByRole('spinbutton', { name: 'Radius', exact: true })
  ).toHaveValue('7');
  await file.setInputFiles({
    name: 'settings.lino',
    mimeType: 'text/plain',
    buffer: Buffer.from(copied),
  });
  await expect(
    page.getByRole('spinbutton', { name: 'Radius', exact: true })
  ).toHaveValue('18');
  await file.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"radius":2,"show-frame":"invalid"}'),
  });
  await expect(
    page.getByRole('status').filter({ hasText: 'Invalid settings' })
  ).toBeVisible();
  await expect(
    page.getByRole('spinbutton', { name: 'Radius', exact: true })
  ).toHaveValue('18');
});

test('panel language changes retain values and localize field-specific steppers and RGB editors', async ({
  page,
}) => {
  await page.goto('/packages/ui-components/examples/rich-settings.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() =>
    globalThis.panel.setMessages({
      settings: 'Настройки',
      search: 'Поиск настроек',
      randomize: 'Случайные значения',
      increment: ({ label }) => `Увеличить ${label}`,
      decrement: ({ label }) => `Уменьшить ${label}`,
      red: ({ label }) => `${label}: красный`,
      green: ({ label }) => `${label}: зелёный`,
      blue: ({ label }) => `${label}: синий`,
      rgb: ({ label }) => `${label}: каналы RGB`,
      palette: ({ label }) => `${label}: палитра`,
    })
  );
  await expect(
    page.getByRole('region', { name: 'Настройки', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('searchbox', { name: 'Поиск настроек' })
  ).toBeVisible();
  const radius = page.getByRole('spinbutton', { name: 'Radius', exact: true });
  await page
    .getByRole('button', { name: 'Увеличить Radius', exact: true })
    .click();
  await expect(radius).toHaveValue('19');
  const red = page.getByRole('slider', {
    name: 'Accent: красный',
    exact: true,
  });
  await red.focus();
  await red.press('ArrowRight');
  await expect(red).toHaveValue('104');
  await expect(
    page.getByRole('spinbutton', {
      name: 'Accent: красный (0–255)',
      exact: true,
    })
  ).toHaveValue('104');
  await page
    .getByRole('spinbutton', { name: 'Accent: зелёный (0–255)', exact: true })
    .fill('0');
  await expect(
    page.getByRole('textbox', { name: 'Accent', exact: true })
  ).toHaveValue('#6800a4');
  await page
    .getByRole('button', { name: 'Ocean #1256ab', exact: true })
    .click();
  await expect(red).toHaveValue('18');
  await expectAccessible(page);
  await page.evaluate(() => globalThis.panel.setMessages({}));
  await expect(
    page.getByRole('button', { name: 'Increase Radius', exact: true })
  ).toBeVisible();
  await expect(radius).toHaveValue('19');
});

test('continuous typing reaches the live store and preview before directional stepping', async ({
  page,
}) => {
  await page.goto('/packages/ui-components/examples/control-contracts.html');
  const input = page.getByRole('spinbutton', { name: 'Opacity', exact: true });
  await input.fill('0.075');
  const stored = () =>
    page.evaluate(
      () =>
        globalThis.editors.store
          .get('opacity')
          .properties.find((p) => p.name === 'value')?.values ?? null
    );
  await expect.poll(stored).toEqual(['0.075']);
  await expect(input).toHaveAttribute('aria-valuenow', '0.075');
  await input.press('Tab');
  await expect(input).toHaveValue('0.075');
  await expect.poll(stored).toEqual(['0.075']);
  await page
    .getByRole('button', { name: 'Increase Opacity', exact: true })
    .click();
  await expect(input).toHaveValue('0.08');
  await input.fill('');
  await expect.poll(stored).toBe(null);
  await page
    .getByRole('button', { name: 'Increase Opacity', exact: true })
    .click();
  await expect(input).toHaveValue('0.08');
  await page.goto('/packages/ui-components/examples/rich-settings.html');
  const radius = page.getByRole('spinbutton', { name: 'Radius', exact: true });
  await radius.fill('0.075');
  await expect
    .poll(() => page.evaluate(() => globalThis.panel.values().radius))
    .toBe(0.075);
  await radius.press('Tab');
  await expect(radius).toHaveValue('0.075');
  await expect(page.locator('.frame-preview span')).toHaveCSS(
    'border-radius',
    '0.075px'
  );
});
