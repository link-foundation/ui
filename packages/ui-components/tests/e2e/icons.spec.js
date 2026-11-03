/**
 * The icon gallery (packages/ui-components/examples/icons.html) in real
 * browsers: WCAG 2.2 A/AA (axe), decorative and labelled icons, icons that
 * follow the text colour in light and dark themes, switching the icon set,
 * RTL mirroring, and visual baselines of the own, Lucide and Material
 * Symbols sets in both themes.
 *
 * The non-own sets come from `node scripts/build-icons.mjs`
 * (packages/ui-components/dist/icons/), which must run first.
 */
import { expect, test } from '@playwright/test';

import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const GALLERY = 'packages/ui-components/examples/icons.html';

/** Own icons whose geometry is the same as the Lucide icon. */
const SAME_IN_LUCIDE = new Set(['chevron-down', 'minus']);

/** Open the gallery with query parameters and wait for its icons. */
async function open(page, params = {}) {
  const query = new globalThis.URLSearchParams(params).toString();
  await page.goto(`${GALLERY}${query ? `?${query}` : ''}`);
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#status')).toHaveText('');
}

/** Switch the set with the radio button and wait for every icon. */
async function switchSet(page, label, set) {
  await page.getByRole('radio', { name: label }).check();
  await expect(page.locator('html')).toHaveAttribute('data-icon-set', set);
}

/** The drawn colour of every icon (in a page or locator) next to its text colour. */
const iconColours = (scope) =>
  scope.locator('ui-icon').evaluateAll((icons) =>
    icons.map((icon) => {
      const shape = icon.querySelector(
        'svg path, svg circle, svg rect, svg line, svg polyline, svg polygon'
      );
      const style = window.getComputedStyle(shape);
      return {
        name: icon.getAttribute('name'),
        text: window.getComputedStyle(icon).color,
        drawn: style.stroke === 'none' ? style.fill : style.stroke,
      };
    })
  );

/** The icon markup of the gallery grid, by name. */
const gridMarkup = (page) =>
  page
    .locator('#grid ui-icon')
    .evaluateAll((icons) =>
      Object.fromEntries(
        icons.map((icon) => [icon.getAttribute('name'), icon.innerHTML])
      )
    );

test.describe('icon gallery', () => {
  for (const theme of ['light', 'dark']) {
    for (const set of ['own', 'lucide', 'material-symbols']) {
      test(`is accessible: ${set}, ${theme}`, async ({ page }) => {
        await open(page, { set, theme });
        await expectAccessible(page);
      });
    }
  }

  test('hides decorative icons and names labelled ones', async ({ page }) => {
    await open(page);
    const decorative = page.locator('#grid ui-icon');
    await expect(decorative).toHaveCount(32);
    for (const icon of await decorative.all()) {
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      await expect(icon).not.toHaveAttribute('role', /./);
    }
    await expect(page.getByRole('img', { name: 'Close' })).toHaveCount(1);
    await expect(page.getByRole('img', { name: 'Warning' })).toHaveCount(1);
    // The labelled icon names its button; the decorative one leaves the
    // button text as its name.
    await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Send' })).toHaveCount(1);
    const send = page.getByRole('button', { name: 'Send' }).locator('ui-icon');
    await expect(send).toHaveAttribute('aria-hidden', 'true');
  });

  test('draws every icon in the text colour of both themes', async ({
    page,
  }) => {
    const seen = {};
    for (const theme of ['light', 'dark']) {
      for (const set of ['own', 'lucide', 'tabler', 'material-symbols']) {
        await open(page, { set, theme });
        const colours = await iconColours(page);
        expect(colours.length).toBeGreaterThan(32);
        for (const { name, text, drawn } of colours) {
          expect(`${set} ${name}: ${drawn}`).toBe(`${set} ${name}: ${text}`);
        }
        seen[theme] = colours.find((c) => c.name === 'menu').text;
      }
    }
    expect(seen.light).not.toBe(seen.dark);
    const accent = page.locator('button.accent');
    const accentColour = await accent.evaluate(
      (el) => window.getComputedStyle(el).color
    );
    const [accentIcon] = await iconColours(accent);
    expect(accentIcon.drawn).toBe(accentColour);
  });

  test('changes the shapes when the set changes to Lucide', async ({
    page,
  }) => {
    await open(page);
    const own = await gridMarkup(page);
    await switchSet(page, 'Lucide', 'lucide');
    const lucide = await gridMarkup(page);
    for (const icon of await page.locator('#grid ui-icon').all()) {
      await expect(icon).toHaveAttribute('data-icon-set', 'lucide');
    }
    // A chevron and a minus are one straight stroke on the 24 grid in
    // both sets, so only their markup may stay the same.
    for (const name of Object.keys(own)) {
      const changed = SAME_IN_LUCIDE.has(name) || lucide[name] !== own[name];
      expect(`${name} changed: ${changed}`).toBe(`${name} changed: true`);
    }
    await expect(page.locator('#credits')).toContainText('ISC');
    await switchSet(page, 'Own', 'own');
    expect(await gridMarkup(page)).toEqual(own);
  });

  test('mirrors direction icons in right-to-left text', async ({ page }) => {
    await open(page, { dir: 'rtl' });
    const transform = (name) =>
      page
        .locator(`#grid ui-icon[name="${name}"] > svg`)
        .evaluate((svg) => window.getComputedStyle(svg).transform);
    expect(await transform('send')).toBe('matrix(-1, 0, 0, 1, 0, 0)');
    expect(await transform('close')).toBe('none');
    await page.getByRole('radio', { name: 'LTR' }).check();
    expect(await transform('send')).toBe('none');
  });

  for (const set of ['own', 'lucide', 'material-symbols']) {
    for (const theme of ['light', 'dark']) {
      test(`matches the ${set} ${theme} baseline`, async ({ page }) => {
        await open(page, { set, theme });
        await expect(page.locator('main')).toHaveScreenshot(
          `icons-${set}-${theme}.png`
        );
      });
    }
  }
});
