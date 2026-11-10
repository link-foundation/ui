/* global getComputedStyle */
import { test, expect } from '@playwright/test';
import { expectAccessible } from '../../../tests/ui/helpers.mjs';

const PAGE = 'packages/ui-components/e2e/pages/page-layout.html';
async function expectCentered(nav) {
  await expect
    .poll(() =>
      nav.evaluate((node) => {
        const a = node.querySelector('[aria-current]').getBoundingClientRect();
        const b = node.getBoundingClientRect();
        return Math.abs((a.left + a.right - b.left - b.right) / 2);
      })
    )
    .toBeLessThan(2);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(PAGE);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
});

for (const direction of ['ltr', 'rtl']) {
  test(`320px current link, route changes and logical fades (${direction})`, async ({
    page,
  }) => {
    await page.evaluate((dir) => {
      document.documentElement.dir = dir;
    }, direction);
    const nav = page.getByRole('navigation', { name: 'Pages' });
    await expectCentered(nav);
    await page.evaluate(() =>
      window.pageLayout.store.setProp('pages', 'active', ['publications'])
    );
    await expect(nav.locator('[aria-current]')).toHaveText('Publications');
    await expectCentered(nav);
    await page.evaluate(() =>
      window.pageLayout.store.setProp('pages', 'active', ['research'])
    );
    await expect(nav.locator('[aria-current]')).toHaveText('Research');
    await expect(nav).toHaveAttribute('data-more', 'start end');
    await expectCentered(nav);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await nav.getByRole('link', { name: 'Home', exact: true }).focus();
    await expect.poll(() => nav.getAttribute('data-more')).toBe('end');
    await page.keyboard.press('Tab');
    await expect(
      nav.getByRole('link', { name: 'Projects', exact: true })
    ).toBeFocused();
    await nav.getByRole('link', { name: 'Resources', exact: true }).focus();
    await expect.poll(() => nav.getAttribute('data-more')).toBe('start');
    await expect(nav).toHaveCSS('scrollbar-width', 'none');
    await expectAccessible(page);
  });
}

test('wraps under the bar, focuses section targets and exposes one link per card', async ({
  page,
}) => {
  const strip = page.locator('ui-nav-strip');
  await expect(strip).toHaveAttribute('data-wrapped', '');
  const geometry = await strip.evaluate((node) => {
    const stripBox = node.getBoundingClientRect();
    const title = node
      .closest('header')
      .querySelector('[data-part="title"]')
      .getBoundingClientRect();
    return { below: stripBox.top >= title.bottom, width: stripBox.width };
  });
  expect(geometry.below).toBe(true);
  expect(geometry.width).toBeGreaterThan(280);
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: 'Work', exact: true })
    .click();
  await expect(page.locator('[data-link-id="work"]')).toBeFocused();
  await page.getByRole('link', { name: 'Back to top' }).click();
  await expect(page.locator('[data-link-id="intro"]')).toBeFocused();
  await expect(page.locator('ui-link-card')).toHaveCount(2);
  await expect(page.locator('ui-link-card a')).toHaveCount(2);
  await expect(page.getByRole('link', { name: /^Documentation / })).toHaveCount(
    1
  );
  const card = page.locator('ui-link-card a').first();
  await card.hover();
  await expect(card).toHaveCSS('transform', 'none');
  await expect(card.locator('[data-part="glyph"]')).toHaveText('↗');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect
    .poll(() => card.evaluate((node) => getComputedStyle(node).transform))
    .not.toBe('none');
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(strip).not.toHaveAttribute('data-wrapped');
});

test('preferences announce cycles, follow system motion, localize and survive reload', async ({
  page,
}) => {
  const theme = page.getByRole('button', { name: 'Theme: system, next light' });
  await expect(theme).toBeVisible();
  await theme.click();
  await page.getByRole('button', { name: 'Theme: light, next dark' }).click();
  await page.getByRole('button', { name: 'Sound: off' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
  await page.getByRole('button', { name: 'Motion: auto, next on' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
  await page.getByRole('button', { name: 'Motion: on, next off' }).click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  const card = page.locator('ui-link-card a').first();
  await card.hover();
  await expect(card).toHaveCSS('transform', 'none');
  await page.getByRole('button', { name: 'Русский' }).click();
  await expect(page.getByRole('button', { name: 'Русский' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(
    page.getByRole('button', { name: 'Русский' }).locator('span')
  ).toHaveAttribute('lang', 'ru');
  await expect(
    page.getByRole('button', { name: 'Тема: тёмная, далее система' })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Тема: тёмная, далее система' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sound: on' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(
    page.getByRole('button', { name: 'Motion: off, next auto' })
  ).toBeVisible();
  await expectAccessible(page);
});

test('wide non-overflow strip removes fades and renders without diagnostics', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(
    page.getByRole('navigation', { name: 'Pages' })
  ).not.toHaveAttribute('data-more');
  expect(await page.evaluate(() => window.pageLayout.diagnostics)).toEqual([]);
  await expectAccessible(page);
});
