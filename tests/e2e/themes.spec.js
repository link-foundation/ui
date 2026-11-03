/* global getComputedStyle, MutationObserver */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { test, expect } from '@playwright/test';
import { expectAccessible } from '../ui/helpers.mjs';

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Theme evidence is captured in Chromium'
);
const open = async (page) => {
  await page.goto('/examples/themes/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
};
const surface = (page, panel, id = 'app') =>
  page
    .locator(`#${panel} [data-link-id="${id}"]`)
    .evaluate((node) =>
      getComputedStyle(node).getPropertyValue('--color-surface').trim()
    );

test('four panels, nested surfaces, template parts and accessible contrast', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  expect(await surface(page, 'light')).toBe('#ffffff');
  expect(await surface(page, 'dark')).toBe('#121316');
  expect(await surface(page, 'nested', 'inside-dark')).toBe('#121316');
  expect(await surface(page, 'nested', 'inside-light')).toBe('#ffffff');
  await expect(
    page.locator('#light ui-button [data-part="indicator"]')
  ).toBeAttached();
  expect(
    await page.evaluate(() =>
      window.themeExample.diagnostics.filter((d) => d.severity === 'error')
    )
  ).toEqual([]);
  await expectAccessible(page);
  const body = await page.locator('.panels').screenshot();
  await info.attach('four-theme-panels', { body, contentType: 'image/png' });
  if (process.env.THEME_SCREENSHOTS) {
    mkdirSync(process.env.THEME_SCREENSHOTS, { recursive: true });
    writeFileSync(join(process.env.THEME_SCREENSHOTS, 'four-panels.png'), body);
  }
  // A control can itself be a boundary, and must still receive scoped styles.
  await page.evaluate(() => {
    const { store, handle } = window.themeExample.mounted.get('light');
    store.setProp('save-light', 'scheme', ['dark']);
    handle.flush();
  });
  const buttonBoundary = page.locator('#light ui-button');
  await buttonBoundary.hover();
  await expect(buttonBoundary).toHaveCSS('opacity', '0.92');
  // An outer theme's styles stop at a nested, different theme boundary.
  await page.evaluate(() => {
    const button = document.querySelector('#light ui-button');
    button.removeAttribute('data-theme');
    const boundary = document.createElement('div');
    boundary.dataset.theme = 'isolated';
    button.before(boundary);
    boundary.append(button);
  });
  await buttonBoundary.hover();
  await expect(buttonBoundary).toHaveCSS('opacity', '1');
  expect(errors).toEqual([]);
});

test('system preferences, explicit full motion and forced colors', async ({
  page,
}) => {
  await open(page);
  await page.emulateMedia({
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    contrast: 'more',
  });
  expect(await surface(page, 'system')).toBe('#121316');
  expect(await surface(page, 'light')).toBe('#ffffff');
  await expect(page.locator('#system [data-link-id="app"]')).toHaveCSS(
    '--motion-duration-short',
    '0ms'
  );
  await page.evaluate(() => {
    const { store, handle } = window.themeExample.mounted.get('system');
    store.setProp('app', 'motion', ['full']);
    handle.flush();
  });
  await expect(page.locator('#system [data-link-id="app"]')).toHaveCSS(
    '--motion-duration-short',
    '150ms'
  );
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(page.locator('#light [data-link-id="app"]')).toHaveCSS(
    '--color-surface',
    'Canvas'
  );
});

test('scheme switch only changes boundary attributes and reload restores before paint', async ({
  page,
}) => {
  await open(page);
  const mutations = await page.evaluate(() => {
    const { store, handle } = window.themeExample.mounted.get('light');
    const node = handle.nodeFor('save-light');
    const observer = new MutationObserver(() => {});
    observer.observe(document.getElementById('light'), {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    store.setProp('app', 'scheme', ['dark']);
    handle.flush();
    const records = observer.takeRecords().map((r) => ({
      type: r.type,
      id: r.target.getAttribute('data-link-id'),
    }));
    observer.disconnect();
    return { same: node === handle.nodeFor('save-light'), records };
  });
  expect(mutations.same).toBe(true);
  expect(mutations.records).toEqual([{ type: 'attributes', id: 'app' }]);
  await page.getByLabel('Saved scheme').selectOption('dark');
  // Block module execution: the synchronous boot script must restore the saved attributes alone.
  await page.route('**/examples/themes/main.js', (route) => route.abort());
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'base');
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');
  await expect(page.locator('body')).not.toHaveAttribute('data-ready', 'true');
});
