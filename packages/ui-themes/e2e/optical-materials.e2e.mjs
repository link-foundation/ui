/* global getComputedStyle, innerHeight */
import { test, expect } from '@playwright/test';
import { expectAccessible } from '../../../tests/ui/helpers.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/packages/ui-themes/e2e/pages/optical-materials.html');
  await page.waitForFunction(() => window.optics);
});

test('optical layers preserve content, frames and browser fallback', async ({
  page,
  browserName,
}) => {
  const style = await page.evaluate(() => window.optics.paint());
  expect(style['backdrop-filter'].includes('url(')).toBe(
    browserName === 'chromium'
  );
  expect(style['backdrop-filter']).toContain('blur(2px) saturate(140%)');
  const before = await page.locator('.frame').first().screenshot();
  await page.evaluate(() => window.optics.paint({ refraction: 0 }));
  const after = await page.locator('.frame').first().screenshot();
  if (browserName === 'chromium') {
    expect(before.equals(after)).toBe(false);
  } else {
    expect(before.equals(after)).toBe(true);
  }
  expect(
    await page.evaluate(
      () => window.optics.paint({}, { transparency: false })['backdrop-filter']
    )
  ).toBe('none');
  expect(
    await page.evaluate(
      () =>
        window.optics.paint({}, { reducedTransparency: true })[
          'backdrop-filter'
        ]
    )
  ).toBe('none');
  expect(
    await page.evaluate(
      () => window.optics.paint({ opacity: 0 })['background-image']
    )
  ).toBe('none');
  await expect(page.locator('.frame').first()).toHaveCSS(
    'border-top-width',
    '3px'
  );
  await expect(page.locator('.content').first()).toHaveCSS('opacity', '1');
  await page.evaluate(() => window.optics.paint());
  await expectAccessible(page);
});

test('5,000 items, dynamic changes, hover, print and disposal', async ({
  page,
}) => {
  await page.evaluate(() => {
    const root = document.querySelector('#items');
    root.innerHTML = '<div class="item"></div>'.repeat(5000);
    window.budget = window.optics.observeMaterialVisibility(root, '.item');
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          [...document.querySelectorAll('.item')].filter(
            (el) => getComputedStyle(el).backdropFilter !== 'none'
          ).length
      )
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.item')].every((el) => {
        const rect = el.getBoundingClientRect();
        return (
          getComputedStyle(el).backdropFilter === 'none' ||
          rect.top <= innerHeight + 200
        );
      })
    )
  ).toBe(true);
  await page
    .locator('.item')
    .last()
    .evaluate((el) => el.scrollIntoView());
  await expect(page.locator('.item').first()).toHaveCSS(
    'backdrop-filter',
    'none'
  );
  await page.locator('.item').last().hover();
  await expect(page.locator('.item').last()).toHaveCSS(
    'backdrop-filter',
    'blur(12px)'
  );
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.item').first()).toHaveCSS(
    'backdrop-filter',
    'blur(4px)'
  );
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => {
    const root = document.querySelector('#items');
    window.removed = root.firstElementChild;
    window.removed.remove();
    root.insertAdjacentHTML(
      'afterbegin',
      '<div class="item" id="added"></div>'
    );
  });
  await expect(page.locator('#added')).toHaveCSS('backdrop-filter', 'none');
  await expect
    .poll(() => page.evaluate(() => window.removed.attributes.length))
    .toBe(1);
  await page.evaluate(() => window.budget.dispose());
  await expect(page.locator('#added')).toHaveCSS(
    'backdrop-filter',
    'blur(4px)'
  );
});

test('static sheen respects reduced motion and explicit settings', async ({
  page,
}) => {
  await page
    .locator('#static')
    .evaluate((el) => el.setAttribute('data-material-motion', ''));
  const animation = () =>
    page
      .locator('#static')
      .evaluate((el) => getComputedStyle(el, '::after').animationName);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await animation()).toBe('none');
  await page.locator('#static').evaluate((el) => (el.dataset.motion = 'on'));
  expect(await animation()).toBe('ui-material-sheen');
  await page.locator('#static').evaluate((el) => (el.dataset.motion = 'off'));
  expect(await animation()).toBe('none');
  await page
    .locator('#static')
    .evaluate((el) => (el.dataset.materialOpacity = '0'));
  await expect(page.locator('#static')).toHaveCSS('backdrop-filter', 'none');
  expect(
    await page
      .locator('#static')
      .evaluate((el) => getComputedStyle(el, '::after').content)
  ).toBe('none');
});
