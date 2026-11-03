import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { test, expect } from '@playwright/test';
import { expectAccessible } from '../ui/helpers.mjs';

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Fluent evidence uses Chromium'
);
for (const forced of [false, true]) {
  test(`Fluent controls, focus and accessibility${forced ? ' in forced colors' : ''}`, async ({
    page,
  }, info) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    if (forced) {
      await page.emulateMedia({ forcedColors: 'active' });
    }
    await page.goto('/examples/themes/fluent2.html');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    expect(await page.evaluate(() => window.fluentExample.diagnostics)).toEqual(
      []
    );
    for (const id of ['light', 'dark', 'contrast']) {
      const panel = page.locator(`#${id}`);
      const button = panel.getByRole('button', { name: 'Save changes' });
      for (const role of ['textbox', 'checkbox', 'radio', 'switch', 'slider']) {
        const control = panel.getByRole(role).first();
        await control.focus();
        await expect(control).toBeFocused();
        const visibleRing =
          role === 'checkbox'
            ? panel.locator('ui-checkbox [data-part="indicator"]')
            : control;
        await expect(visibleRing).toHaveCSS('outline-width', '2px');
        await expect(visibleRing).toHaveCSS('outline-style', 'solid');
      }
      await button.focus();
      await expect(button).toHaveCSS('outline-width', '2px');
      await expect(button).toHaveCSS('outline-style', 'solid');
      await expect(button).toBeFocused();
      const body = await panel.screenshot();
      const name = `${id}${forced ? '-forced' : ''}.png`;
      await info.attach(name, { body, contentType: 'image/png' });
      if (process.env.FLUENT_SCREENSHOTS) {
        mkdirSync(process.env.FLUENT_SCREENSHOTS, { recursive: true });
        writeFileSync(join(process.env.FLUENT_SCREENSHOTS, name), body);
      }
    }
    await expectAccessible(page);
    const button = page
      .locator('#light')
      .getByRole('button', { name: 'Save changes' });
    if (!forced) {
      await button.hover();
      await expect(button).toHaveCSS('background-color', 'rgb(17, 94, 163)');
      await expect(button).toHaveCSS(
        'box-shadow',
        'rgba(0, 0, 0, 0) 0px 0px 0px 0px'
      );
      await page.mouse.down();
      await expect(button).toHaveCSS('background-color', 'rgb(12, 59, 94)');
      await page.mouse.up();
    } else {
      await expect(page.locator('#light ui-document')).toHaveCSS(
        '--color-outline',
        'CanvasText'
      );
    }
    await page.locator('#light').getByRole('switch').click();
    await expect(page.locator('#light').getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'false'
    );
    const slider = page.locator('#light').getByRole('slider');
    await slider.focus();
    await slider.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuenow', '41');
    if (!forced) {
      const indicator = page.locator(
        '#dark ui-checkbox [data-part="indicator"]'
      );
      await expect(indicator).toHaveCSS(
        'background-color',
        'rgb(71, 158, 245)'
      );
      await page.evaluate(() => {
        const { store, handle } = window.fluentExample.mounted.get('dark');
        store.setProp('agree-dark', 'disabled', ['true']);
        handle.flush();
      });
      await expect(indicator).toHaveCSS('background-color', 'rgb(20, 20, 20)');
    }
    expect(errors).toEqual([]);
  });
}
