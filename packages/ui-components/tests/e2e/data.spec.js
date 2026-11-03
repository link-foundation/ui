/** APG keys and measured virtualization, in both Chromium and WebKit. */
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';
const PAGE = 'packages/ui-components/examples/data.html';
const rows = (page) => page.locator('ui-list [role=option]');
const key = (page, id) => page.locator(`[data-key="${id}"]`);
const scroller = (page, kind = 'list') =>
  page.locator(`ui-${kind} .ui-data-scroll`);
const focused = (page) => page.locator(':focus');

async function open(page) {
  await page.goto(PAGE);
  await page.locator('body[data-ready=true]').waitFor();
  expect(await page.evaluate(() => window.dataExample.diagnostics)).toEqual([]);
}
async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(resolve)
        )
      )
  );
}
async function screenshot(locator, name, info) {
  if (process.env.DATA_DOCS_SCREENSHOTS && info.project.name === 'chromium') {
    await locator.screenshot({
      path: join(
        import.meta.dirname,
        '../../../../docs/screenshots/issue-37',
        name
      ),
    });
  }
}

test('100000 rows: DOM bound, correct contents at 50000, focus retained outside range and prepend 50 within 1px', async ({
  page,
}, info) => {
  await open(page);
  await key(page, 'item-0').focus();
  for (const top of [16000, 1600000, 3199500]) {
    await scroller(page).evaluate((node, value) => {
      node.scrollTop = value;
    }, top);
    await settle(page);
    expect(await rows(page).count()).toBeLessThan(200);
    await expect(focused(page)).toHaveAttribute('data-key', 'item-0');
  }
  await scroller(page).evaluate((node) => {
    node.scrollTop = 1600000;
  });
  await settle(page);
  const anchor = key(page, 'item-50000');
  await expect(anchor).toHaveText('Item 50000');
  await expect(anchor).toHaveAttribute('aria-posinset', '50001');
  await expect(anchor).toHaveAttribute('aria-setsize', '100000');
  await screenshot(page.locator('#sidebar'), 'list-50000.png', info);
  const before = (await anchor.boundingBox()).y;
  await page.evaluate(() => document.getElementById('prepend').click());
  await settle(page);
  expect(Math.abs((await anchor.boundingBox()).y - before)).toBeLessThanOrEqual(
    1
  );
  await expect(anchor).toHaveAttribute('aria-setsize', '100050');
  expect(await rows(page).count()).toBeLessThan(200);
});

test('listbox: ArrowDown/Up, Home/End, PageDown/Up, Space, Shift, Ctrl/Meta+A and typeahead', async ({
  page,
}) => {
  await open(page);
  await key(page, 'item-0').focus();
  await page.keyboard.press('ArrowDown');
  await expect(focused(page)).toHaveAttribute('data-key', 'item-1');
  await page.keyboard.press('ArrowUp');
  await expect(focused(page)).toHaveAttribute('data-key', 'item-0');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect(focused(page)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(key(page, 'item-1')).toHaveAttribute('aria-selected', 'true');
  await expect(key(page, 'item-2')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Control+ArrowDown');
  await expect(focused(page)).toHaveAttribute('data-key', 'item-3');
  await page.keyboard.press('Control+Space');
  await expect(focused(page)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(focused(page)).toHaveAttribute('data-key', 'item-0');
  await page.keyboard.press('End');
  await expect(focused(page)).toHaveAttribute('data-key', 'item-99999');
  await page.keyboard.press('Home');
  await page.keyboard.press('PageDown');
  await expect(focused(page)).toHaveAttribute('data-key', 'item-10');
  await page.keyboard.press('PageUp');
  await expect(focused(page)).toHaveAttribute('data-key', 'item-0');
  await page.keyboard.press('i');
  await expect(focused(page)).toHaveAttribute('data-key', 'item-1');
  await page.keyboard.press('Enter');
  await expect(page.locator('#action')).toHaveText('Action: Item 1');
  await page.keyboard.press('Meta+a');
  await expect(key(page, 'item-0')).toHaveAttribute('aria-selected', 'true');
});

test('tree: Right/Left, Up/Down, Home/End, *, typeahead and lazy children', async ({
  page,
}, info) => {
  await open(page);
  await key(page, 'project').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(focused(page)).toHaveAttribute('data-key', 'src');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(focused(page)).toHaveAttribute('data-key', 'node-0');
  await expect(focused(page)).toHaveAttribute('aria-level', '3');
  await expect(focused(page)).toHaveAttribute('aria-setsize', '1997');
  await screenshot(page.locator('ui-tree'), 'tree-three-levels.png', info);
  await page.keyboard.press('ArrowLeft');
  await expect(focused(page)).toHaveAttribute('data-key', 'src');
  await page.keyboard.press('ArrowLeft');
  await expect(key(page, 'node-0')).toHaveCount(0);
  await page.keyboard.press('End');
  await expect(focused(page)).toHaveAttribute('data-key', 'lazy');
  await page.keyboard.press('ArrowRight');
  await expect(key(page, 'lazy-child')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(focused(page)).toHaveAttribute('data-key', 'lazy-child');
  await page.keyboard.press('ArrowUp');
  await expect(focused(page)).toHaveAttribute('data-key', 'lazy');
  await page.keyboard.press('Home');
  await page.keyboard.press('o');
  await expect(focused(page)).toHaveAttribute('data-key', 'lazy');
  await page.keyboard.press('*');
});

test('grid: all arrows, Home/End, Ctrl+Home/End, PageUp/Down, Space, stable sorting, sticky header and resize', async ({
  page,
}, info) => {
  await open(page);
  const header = page.locator('ui-table [role=columnheader][data-column=age]');
  await header.locator('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  await expect(page.locator('ui-table [data-key]').nth(0)).toHaveAttribute(
    'data-key',
    'person-0'
  );
  await expect(page.locator('ui-table [data-key]').nth(1)).toHaveAttribute(
    'data-key',
    'person-80'
  );
  await screenshot(page.locator('ui-table'), 'table-age-sorted.png', info);
  const cell = key(page, 'person-0').locator('[role=gridcell]').first();
  await cell.focus();
  await page.keyboard.press('ArrowRight');
  await expect(focused(page)).toHaveAttribute('aria-colindex', '2');
  await page.keyboard.press('ArrowDown');
  await expect(focused(page).locator('..')).toHaveAttribute(
    'data-key',
    'person-80'
  );
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('End');
  await expect(focused(page)).toHaveAttribute('aria-colindex', '3');
  await page.keyboard.press('Home');
  await expect(focused(page)).toHaveAttribute('aria-colindex', '1');
  await page.keyboard.press('Control+End');
  await expect(focused(page).locator('..')).toHaveAttribute(
    'data-key',
    'person-9999'
  );
  await page.keyboard.press('Control+Home');
  await expect(focused(page).locator('..')).toHaveAttribute(
    'data-key',
    'person-0'
  );
  await page.keyboard.press('ArrowUp');
  await expect(focused(page)).toHaveAttribute('data-sort', 'name');
  await expect(focused(page)).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  await page.keyboard.press('Space');
  await expect(header).toHaveAttribute('aria-sort', 'none');
  await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('PageDown');
  const focusedBox = await focused(page).boundingBox();
  const viewportBox = await scroller(page, 'table').boundingBox();
  expect(focusedBox.y + focusedBox.height).toBeLessThanOrEqual(
    viewportBox.y + viewportBox.height + 1
  );
  await page.keyboard.press('PageUp');
  await page.keyboard.press('Space');
  await expect(key(page, 'person-0')).toHaveAttribute('aria-selected', 'true');
  const resize = page.locator('ui-table [role=separator]').first();
  await resize.focus();
  await page.keyboard.press('ArrowRight');
  await expect(resize).toHaveAttribute('aria-valuenow', '250');
  const box = await resize.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2);
  await page.mouse.up();
  await expect.poll(() => resize.getAttribute('aria-valuenow')).toBe('290');
  await scroller(page, 'table').evaluate((node) => {
    node.scrollTop = 1000;
  });
  await settle(page);
  const headerBox = await page.locator('.ui-data-header').boundingBox();
  const scrollBox = await scroller(page, 'table').boundingBox();
  expect(Math.abs(headerBox.y - scrollBox.y)).toBeLessThanOrEqual(1);
  await header.locator('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  await header.locator('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'none');
});

test('nested sidebar wheel scroll and keyboard scrolling preserve native scroll chaining', async ({
  page,
}) => {
  await open(page);
  await scroller(page).hover();
  await page.mouse.wheel(0, 500);
  await expect
    .poll(() => scroller(page).evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  expect(
    await page.locator('#sidebar').evaluate((node) => node.scrollTop)
  ).toBe(0);
  await key(page, 'item-0').focus();
  await page.keyboard.press('PageDown');
  await expect(focused(page)).toHaveAttribute('data-key', 'item-10');
  await scroller(page).evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await settle(page);
  await scroller(page).hover();
  await expect
    .poll(async () => {
      await page.mouse.wheel(0, 100);
      return page.locator('#sidebar').evaluate((node) => node.scrollTop);
    })
    .toBeGreaterThan(0);
});

test('variable measured heights retain anchor on resize and prepend', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    window.dataExample.rows.set(
      Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        label: `Item ${i}${i % 2 ? ' extra content'.repeat(20) : ''}`,
      }))
    );
  });
  await key(page, 'item-0').focus();
  await scroller(page).evaluate((node) => {
    node.scrollTop = 600;
  });
  await settle(page);
  expect(await rows(page).count()).toBeLessThan(200);
  const heights = await rows(page).evaluateAll((nodes) =>
    nodes.map((n) => n.getBoundingClientRect().height)
  );
  expect(Math.max(...heights)).toBeGreaterThan(Math.min(...heights));
  const anchor = await rows(page).evaluateAll((nodes) => {
    const viewport = document
      .querySelector('ui-list .ui-data-scroll')
      .getBoundingClientRect();
    const row = nodes.find((node) => {
      const box = node.getBoundingClientRect();
      return box.top <= viewport.top && box.bottom > viewport.top;
    });
    return { key: row.dataset.key, y: row.getBoundingClientRect().y };
  });
  await page.evaluate(() => document.getElementById('prepend').click());
  await settle(page);
  expect(
    Math.abs((await key(page, anchor.key).boundingBox()).y - anchor.y)
  ).toBeLessThanOrEqual(1);
  await scroller(page).evaluate((node) => {
    node.style.width = '70%';
  });
  await expect
    .poll(async () =>
      Math.abs((await key(page, anchor.key).boundingBox()).y - anchor.y)
    )
    .toBeLessThanOrEqual(1);
});

for (const scheme of ['light', 'dark']) {
  test(`example has no axe violations in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    await expectAccessible(page);
  });
}

test.describe('touch scrolling', () => {
  test.use({ hasTouch: true });
  test('native touch gesture scrolls the inner list in a sidebar', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'CDP delivers real touch gestures in Chromium'
    );
    await open(page);
    const box = await scroller(page).boundingBox();
    const session = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2;
    const y = box.y + box.height - 30;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    for (let offset = 20; offset <= 180; offset += 20) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - offset }],
      });
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect
      .poll(() => scroller(page).evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0);
    expect(
      await page.locator('#sidebar').evaluate((node) => node.scrollTop)
    ).toBe(0);
    await session.detach();
  });
});
