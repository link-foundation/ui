/* global getComputedStyle */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { test, expect } from '@playwright/test';
import { expectAccessible } from '../ui/helpers.mjs';

const open = async (page) => {
  await page.goto('/examples/themes/material3.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
};
test('Material 3 controls in three schemes, axe and screenshots', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  expect(
    await page.evaluate(() =>
      window.material3Gallery.diagnostics.filter((d) => d.severity === 'error')
    )
  ).toEqual([]);
  for (const scheme of ['light', 'dark', 'contrast']) {
    const panel = page.locator(`#${scheme}`);
    await expect(panel.getByRole('button')).toHaveCount(5);
    await expect(panel.getByRole('textbox')).toHaveCount(2);
    await expect(panel.getByRole('checkbox')).toBeChecked();
    await expect(panel.getByRole('switch')).toBeChecked();
    await expect(panel.getByRole('radio')).toHaveCount(2);
    await expect(panel.getByRole('slider')).toHaveAttribute(
      'aria-valuenow',
      '40'
    );
    const body = await panel.screenshot();
    await info.attach(`material3-${scheme}`, {
      body,
      contentType: 'image/png',
    });
    if (process.env.MATERIAL3_SCREENSHOTS && info.project.name === 'chromium') {
      mkdirSync(process.env.MATERIAL3_SCREENSHOTS, { recursive: true });
      writeFileSync(
        join(process.env.MATERIAL3_SCREENSHOTS, `${scheme}.png`),
        body
      );
    }
  }
  await expectAccessible(page);
  await page.locator('#light').getByRole('checkbox').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#light').getByRole('checkbox')).not.toBeChecked();
  const slider = page.locator('#dark').getByRole('slider');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', '41');
  expect(errors).toEqual([]);
});
test('variants affect native parts and keyboard focus survives contrast and forced colors', async ({
  page,
}) => {
  await open(page);
  const tonal = page.locator('#light ui-button[variant="tonal"] button');
  const filled = page.locator('#light ui-button[variant="filled"] button');
  const tonalColor = await tonal.evaluate(
    (n) => getComputedStyle(n).backgroundColor
  );
  expect(tonalColor).not.toBe(
    await filled.evaluate((n) => getComputedStyle(n).backgroundColor)
  );
  await tonal.evaluate((n) =>
    n.closest('ui-button').setAttribute('data-theme', 'material3')
  );
  await expect(tonal).toHaveCSS('background-color', tonalColor);
  await tonal.evaluate((n) =>
    n.closest('ui-button').setAttribute('data-theme', 'isolated')
  );
  await expect(tonal).not.toHaveCSS('background-color', tonalColor);
  await tonal.evaluate((n) =>
    n.closest('ui-button').setAttribute('data-theme', 'material3')
  );
  await expect(tonal).toHaveCSS('background-color', tonalColor);
  const elevated = page.locator('#light ui-button[variant="elevated"] button');
  await expect(elevated).toHaveCSS('background-color', 'rgb(248, 242, 250)');
  const field = page.locator('#light ui-text-field[variant="filled"] input');
  await expect(field).toHaveCSS('border-top-width', '0px');
  for (const forcedColors of ['none', 'active']) {
    await page.emulateMedia({ forcedColors });
    const button = page
      .locator('#contrast ui-button')
      .first()
      .getByRole('button');
    await button.focus();
    await expect(button).toBeFocused();
    await expect(button).toHaveCSS('outline-style', 'solid');
    expect(
      await button.evaluate((n) => parseFloat(getComputedStyle(n).outlineWidth))
    ).toBeGreaterThanOrEqual(2);
  }
});
