import { test, expect } from '@playwright/test';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const example = '/packages/ui-components/examples/links-gallery.html';
test('counts, filters, host URLs, localisation and accessibility', async ({
  page,
}) => {
  const errors = [];
  const workers = [];
  page.on('worker', (worker) => workers.push(worker.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(example);
  const gallery = page.locator('links-gallery');
  const cards = gallery.locator('.card');
  await expect(cards).toHaveCount(81);
  await expect(cards.first()).toHaveAttribute(
    'href',
    /\/network\/\?code=0000&theme=light$/
  );
  await expect(gallery.locator('p')).toHaveText(
    'first 00 00 … last 22 22: 3^(4) = 81'
  );
  await expect(
    gallery.getByRole('tab', { name: '2 links · 81 networks', exact: true })
  ).toHaveAttribute('aria-selected', 'true');
  await gallery.getByLabel('Classes only').check();
  await expect(cards).toHaveCount(45);
  await gallery.getByLabel('Real-only').check();
  await expect(cards).toHaveCount(10);
  await expect(
    gallery.getByRole('tab', { name: '2 links · 10 classes', exact: true })
  ).toHaveAttribute('aria-selected', 'true');
  await gallery.getByLabel('Classes only').uncheck();
  await expect(cards).toHaveCount(16);
  await gallery.getByLabel('Classes only').check();
  await expect(cards).toHaveCount(10);
  await gallery.evaluate((el) => {
    el.setAttribute('lang', 'ru');
    el.setAttribute('theme', 'dark');
  });
  await expect(
    gallery.getByRole('tab', { name: '2 связи · 10 классов', exact: true })
  ).toBeVisible();
  await expect(cards.first()).toHaveAttribute('href', /theme=dark$/);
  const sizes = await gallery
    .locator('links-gallery-network')
    .first()
    .evaluate((el) => ({
      width: el.clientWidth,
      height: el.clientHeight,
      tabIndex: el.tabIndex,
      items: el.items.length,
    }));
  expect(sizes).toEqual({ width: 64, height: 64, tabIndex: -1, items: 2 });
  await expectAccessible(page);
  expect(errors).toEqual([]);
  expect(workers).toEqual([]);
});

test('keyboard size tabs and pages append only 243 thumbnails', async ({
  page,
}) => {
  await page.goto(example);
  const gallery = page.locator('links-gallery');
  const cards = gallery.locator('.card');
  const two = gallery.getByRole('tab', {
    name: '2 links · 81 networks',
    exact: true,
  });
  await two.focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    gallery.getByRole('tab', { name: '3 links · 4,096 networks', exact: true })
  ).toBeFocused();
  await expect(cards).toHaveCount(243);
  const more = gallery.getByRole('button', { name: 'Show more', exact: true });
  await more.click();
  await expect(cards).toHaveCount(486);
  await expect(more).toBeVisible();
  await page.keyboard.press('Home');
});

test('every thumbnail draws and reconnecting preserves bounded state', async ({
  page,
}) => {
  await page.goto(example);
  const gallery = page.locator('links-gallery');
  await expect(gallery.locator('.card')).toHaveCount(81);
  await expect
    .poll(() =>
      gallery
        .locator('links-gallery-network')
        .evaluateAll((nodes) =>
          nodes.every((el) => el.drawn && el.diagnostics.length === 0)
        )
    )
    .toBe(true);
  const bounds = await gallery
    .locator('links-gallery-network')
    .evaluateAll((nodes) =>
      nodes.map((el) => {
        const box = el.shadowRoot.querySelector('[data-part=items]').getBBox();
        return {
          x: box.x * el.view.k + el.view.x,
          y: box.y * el.view.k + el.view.y,
          right: (box.x + box.width) * el.view.k + el.view.x,
          bottom: (box.y + box.height) * el.view.k + el.view.y,
        };
      })
    );
  for (const box of bounds) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(64);
    expect(box.bottom).toBeLessThanOrEqual(64);
  }
  await gallery.evaluate((el) => {
    el.remove();
    document.querySelector('main').append(el);
  });
  await expect(gallery.locator('.card')).toHaveCount(81);
  await gallery
    .getByRole('tab', { name: '1 link · 4 networks', exact: true })
    .click();
  await expect(gallery.locator('.card')).toHaveCount(4);
  await expectAccessible(page);
});
