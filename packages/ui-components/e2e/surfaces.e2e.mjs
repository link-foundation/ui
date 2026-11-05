/**
 * The surfaces, chip, accordion and circular progress in a real browser
 * (Chromium and WebKit), under the Material 3 theme in light, dark and high
 * contrast: the keyboard only, focus, reduced motion and WCAG 2.2 A/AA.
 */
/* global getComputedStyle */
import { expect, test } from '@playwright/test';

import { expectAccessible } from '../../../tests/ui/helpers.mjs';

const PAGE = 'packages/ui-components/e2e/pages/surfaces.html';
const SCHEMES = ['light', 'dark', 'contrast'];

test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
});

/** A computed style of the first element matching the locator. */
const styleOf = (locator, name) =>
  locator.evaluate((node, prop) => getComputedStyle(node)[prop], name);

test('every kind renders in each scheme without diagnostics or violations', async ({
  page,
}) => {
  const errors = await page.evaluate(() =>
    window.surfacesGallery.diagnostics.filter((d) => d.severity === 'error')
  );
  expect(errors).toEqual([]);
  for (const scheme of SCHEMES) {
    const panel = page.locator(`#${scheme}`);
    await expect(panel.getByRole('group', { name: 'Starter' })).toBeVisible();
    await expect(panel.locator('ui-paper')).toHaveCount(3);
    await expect(panel.locator('ui-app-bar header')).toHaveCount(2);
    await expect(panel.locator('ui-chip')).toHaveCount(5);
    await expect(panel.locator('ui-accordion')).toHaveCount(3);
    await expect(panel.getByRole('progressbar')).toHaveCount(2);
  }
  await expectAccessible(page);
});

test('the theme reaches the surfaces and follows the scheme', async ({
  page,
}) => {
  const raised = (scheme) => page.locator(`#${scheme} ui-paper[elevation="3"]`);
  await expect(raised('light')).not.toHaveCSS('box-shadow', 'none');
  // Elevation 0 is the token's shadow with no offset, blur or spread.
  expect(
    await styleOf(page.locator('#light ui-paper[elevation="0"]'), 'boxShadow')
  ).not.toMatch(/[1-9]\d*px/);
  expect(await styleOf(raised('light'), 'backgroundColor')).not.toBe(
    await styleOf(raised('dark'), 'backgroundColor')
  );
  const square = page.locator('#light ui-paper[square]');
  await expect(square).toHaveCSS('border-top-left-radius', '0px');
  const primary = page.locator('#light ui-app-bar[tone="primary"] header');
  const surface = page.locator('#light ui-app-bar[tone="surface"] header');
  expect(await styleOf(primary, 'backgroundColor')).not.toBe(
    await styleOf(surface, 'backgroundColor')
  );
  const filled = page.locator('#light ui-chip[tone="neutral"]').first();
  const outlined = page.locator('#light ui-chip[variant="outlined"]');
  expect(
    await styleOf(filled.locator('[data-part="root"]'), 'backgroundColor')
  ).not.toBe(
    await styleOf(outlined.locator('[data-part="root"]'), 'backgroundColor')
  );
  await expect(outlined.locator('[data-part="root"]')).toHaveCSS(
    'border-top-style',
    'solid'
  );
});

test('a chip is removed with the keyboard and focus moves on', async ({
  page,
}) => {
  const panel = page.locator('#light');
  const remove = (name) =>
    panel.getByRole('button', { name: `Remove ${name}` });
  await remove('Ada').focus();
  await page.keyboard.press('Enter');
  await expect(panel.locator('ui-chip[data-value="ada"]')).toBeHidden();
  await expect(remove('Alan')).toBeFocused();
  await page.keyboard.press('Delete');
  await expect(panel.locator('ui-chip[data-value="alan"]')).toBeHidden();
  await expect(remove('Grace')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(panel.locator('ui-chip[data-value="grace"]')).toBeHidden();
  // Nothing else can take it: the row keeps focus, it is not lost to body.
  await expect(panel.locator('ui-stack')).toBeFocused();
  const removed = await page.evaluate(() =>
    window.surfacesGallery.changes.filter((c) => c.property === 'removed')
  );
  expect(removed.length).toBe(3);
  await expect(remove('Archived')).toBeDisabled();
  await expect(panel.locator('ui-chip', { hasText: 'Plain' })).toBeVisible();
  await expect(
    panel.locator('ui-chip', { hasText: 'Plain' }).getByRole('button')
  ).toHaveCount(0);
});

test('a chip shows focus on its remove button in each scheme', async ({
  page,
}) => {
  for (const scheme of SCHEMES) {
    const remove = page
      .locator(`#${scheme}`)
      .getByRole('button', { name: 'Remove Ada' });
    await remove.focus();
    await expect(remove).toHaveCSS('outline-style', 'solid');
  }
});

test('an accordion discloses with the keyboard and names its region', async ({
  page,
}) => {
  const panel = page.locator('#dark');
  const shipping = panel.getByRole('button', { name: 'Shipping' });
  const returns = panel.getByRole('button', { name: 'Returns' });
  const warranty = panel.getByRole('button', { name: 'Warranty' });
  await expect(panel.getByRole('heading', { name: 'Shipping' })).toBeVisible();
  await expect(shipping).toHaveAttribute('aria-expanded', 'false');
  await expect(returns).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByText('Two to five days.')).toBeHidden();
  await expect(panel.getByRole('region', { name: 'Returns' })).toContainText(
    'Free within thirty days.'
  );

  await shipping.focus();
  await page.keyboard.press('Enter');
  await expect(shipping).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByText('Two to five days.')).toBeVisible();
  await expect(shipping).toBeFocused();
  await page.keyboard.press('Space');
  await expect(shipping).toHaveAttribute('aria-expanded', 'false');
  await expect(panel.getByText('Two to five days.')).toBeHidden();

  // The arrows, Home and End move among the enabled headers and wrap.
  await page.keyboard.press('ArrowDown');
  await expect(returns).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(shipping).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(returns).toBeFocused();
  await page.keyboard.press('Home');
  await expect(shipping).toBeFocused();
  await page.keyboard.press('End');
  await expect(returns).toBeFocused();
  await expect(warranty).toBeDisabled();
  await expect(returns).toHaveCSS('outline-style', 'solid');

  // Escape from inside the section closes it and brings focus back.
  await shipping.focus();
  await page.keyboard.press('Enter');
  await panel.getByRole('link', { name: 'Tracking' }).focus();
  await page.keyboard.press('Escape');
  await expect(shipping).toHaveAttribute('aria-expanded', 'false');
  await expect(shipping).toBeFocused();
});

test('circular progress keeps the progressbar semantics', async ({ page }) => {
  for (const scheme of SCHEMES) {
    const panel = page.locator(`#${scheme}`);
    const ring = panel.getByRole('progressbar', { name: 'Uploading' });
    await expect(ring).toHaveAttribute('aria-valuenow', '40');
    await expect(ring).toHaveAttribute('aria-valuemax', '100');
    const spinner = panel.getByRole('progressbar', {
      name: 'Loading',
      exact: true,
    });
    await expect(spinner).not.toHaveAttribute('aria-valuenow', /.*/);
    await expect(spinner).not.toHaveAttribute('aria-valuetext', /.*/);
  }
});

test('reduced motion stops the ring and drops the accordion animation', async ({
  page,
}) => {
  const seconds = async (locator) =>
    parseFloat(await styleOf(locator, 'animationDuration'));
  const indicator = page.locator(
    '#light ui-progress[shape="circular"][data-indeterminate] [data-part="indicator"]'
  );
  const returns = page
    .locator('#light')
    .getByRole('button', { name: 'Returns' });
  const content = page
    .locator('#light ui-accordion')
    .nth(1)
    .locator('[data-part="content"]');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(indicator).toHaveCSS('animation-name', 'ui-progress-spin');
  expect(await seconds(indicator)).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // The theme's motion tokens collapse to zero: the ring stands still.
  expect(await seconds(indicator)).toBe(0);
  await returns.focus();
  await page.keyboard.press('Enter');
  await expect(returns).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(content).toHaveAttribute('data-state', 'open');
  await expect(content).toHaveCSS('animation-name', 'none');
});

test('an accordion animates a change, not its first paint', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const returns = page
    .locator('#light')
    .getByRole('button', { name: 'Returns' });
  const content = page
    .locator('#light ui-accordion')
    .nth(1)
    .locator('[data-part="content"]');
  await expect(content).toHaveAttribute('data-state', 'open');
  await expect(content).toHaveCSS('animation-name', 'none');
  await returns.focus();
  await page.keyboard.press('Enter');
  await expect(returns).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(returns).toHaveAttribute('aria-expanded', 'true');
  await expect(content).toHaveCSS('animation-name', 'ui-accordion-open');
});

test('forced colors keep the parts and the focus ring visible', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  const shipping = page
    .locator('#contrast')
    .getByRole('button', { name: 'Shipping' });
  await shipping.focus();
  await expect(shipping).toHaveCSS('outline-style', 'solid');
  const remove = page
    .locator('#contrast')
    .getByRole('button', { name: 'Remove Ada' });
  await remove.focus();
  await expect(remove).toHaveCSS('outline-style', 'solid');
});
