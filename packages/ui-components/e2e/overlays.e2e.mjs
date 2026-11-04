import { expect, test } from '@playwright/test';
import {
  axeViolations,
  expectAccessible,
  screenshotMatrix,
} from '../../../tests/ui/helpers.mjs';
const PAGE = 'packages/ui-components/e2e/pages/overlays.html';
const byId = (page, id) => page.locator(`[data-link-id="${id}"]`);
const freezeClock = async (page) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
};
const open = (page, id) =>
  page.evaluate((id) => window.controller(id).open(), id);

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('#app[data-ready="true"]')).toBeAttached();
});

test('gallery mounts without diagnostics', async ({ page }) => {
  expect(await page.evaluate(() => window.gallery.handle.diagnostics)).toEqual(
    []
  );
  await expectAccessible(page);
});

test('dialog traps Tab, makes background inert, Escape closes and restores opener', async ({
  page,
}) => {
  const opener = page.locator('#open-dialog');
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = byId(page, 'confirm');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveJSProperty('open', true);
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement))
  ).toBe(true);
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press(index % 2 ? 'Shift+Tab' : 'Tab');
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement))
    ).toBe(true);
  }
  await opener.evaluate((node) => node.focus());
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement))
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => window.actions.at(-1).action)).toEqual([
    'emit',
    'dialog-closed',
  ]);
});

test('raised #36 window stays behind a modal in the native top layer', async ({
  page,
}) => {
  await page.evaluate(() => window.raiseWindow());
  await page.locator('#open-dialog').click();
  const dialog = byId(page, 'confirm');
  const box = await dialog.boundingBox();
  expect(
    await page.evaluate(
      ({ x, y }) => {
        const dialog = window.gallery.handle.nodeFor('confirm');
        const win = window.gallery.handle.nodeFor('background-window');
        win.dispatchEvent(
          new window.PointerEvent('pointerdown', { bubbles: true })
        );
        return dialog.contains(document.elementFromPoint(x, y));
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    )
  ).toBe(true);
});

test('menu button, roving focus, typeahead, activation and submenu', async ({
  page,
}) => {
  await page.locator('#open-menu').focus();
  await page.keyboard.press('ArrowDown');
  await expect(byId(page, 'reply')).toBeFocused();
  await page.keyboard.press('End');
  await expect(byId(page, 'more')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(byId(page, 'archive')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(byId(page, 'more')).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('c');
  await expect(byId(page, 'copy')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#open-menu')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.actions.at(-1).action)).toEqual([
    'emit',
    'reply',
  ]);
});

test('Escape closes only the submenu and updates its trigger ARIA', async ({
  page,
}) => {
  await page.locator('#open-menu').click();
  await byId(page, 'more').focus();
  await page.keyboard.press('ArrowRight');
  await expect(byId(page, 'more')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(byId(page, 'submenu')).toBeHidden();
  await expect(byId(page, 'message-menu')).toBeVisible();
  await expect(byId(page, 'more')).toBeFocused();
  await expect(byId(page, 'more')).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await expect(page.locator('#open-menu')).toBeFocused();
});

test('popover light dismiss and dialog action content', async ({ page }) => {
  await page.locator('#open-popover').click();
  await expect(byId(page, 'details')).toBeVisible();
  await page.locator('#outside-target').click();
  await expect(byId(page, 'details')).toBeHidden();
  await expect(page.locator('#open-popover')).toHaveAttribute(
    'aria-expanded',
    'false'
  );
  await page.locator('#open-dialog').click();
  await byId(page, 'confirm')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(byId(page, 'confirm')).toBeHidden();
  await expect(page.locator('#open-dialog')).toBeFocused();
  await page.evaluate(() => {
    const dialog = window.controller('confirm');
    dialog.open();
    dialog.close();
    dialog.open();
  });
  await expect(byId(page, 'confirm')).toBeVisible();
  await expect(byId(page, 'confirm')).toHaveJSProperty('open', true);
});

test('select shares top-layer placement, flips at the edge and preserves its machine', async ({
  page,
}) => {
  await page.addStyleTag({
    url: '/packages/ui-components/src/controls/styles.css',
  });
  await page.evaluate(async () => {
    const { mountControls } = await import('../../src/controls/index.js');
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;bottom:8px;right:8px;width:200px';
    document.body.append(container);
    window.selectFixture = mountControls(
      container,
      `fruit: select
  label Fruit
  apple: option
    label Apple
    value apple
  pear: option
    label Pear
    value pear
`
    );
  });
  const input = byId(page, 'fruit').locator('[data-part="input"]');
  const listbox = byId(page, 'fruit').locator('[role="listbox"]');
  await input.focus();
  await page.keyboard.press('ArrowDown');
  await expect(listbox).toBeVisible();
  await expect(listbox).toHaveAttribute('popover', 'auto');
  await expect
    .poll(() => listbox.evaluate((node) => node.matches(':popover-open')))
    .toBe(true);
  await expect
    .poll(() => listbox.evaluate((node) => node.style.position))
    .toBe('fixed');
  const box = await listbox.boundingBox();
  const anchor = await input.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(anchor.y);
  expect(box.x + box.width).toBeLessThanOrEqual(1280);
  await expect(input).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(listbox).toBeHidden();
  await expect(input).toHaveText('Pear');
  await input.click();
  await expect(listbox).toBeVisible();
  await page.locator('#outside-target').click();
  await expect(listbox).toBeHidden();
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await page.evaluate(() => window.selectFixture.destroy());
});

test('context keys, arrows and target separate from multi-selection', async ({
  page,
}) => {
  const target = page.locator('#context-target');
  await target.focus();
  await page.keyboard.press('Shift+F10');
  await expect(byId(page, 'target-reply')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(byId(page, 'target-copy')).toBeFocused();
  await page.keyboard.press('d');
  await expect(byId(page, 'target-delete')).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.actions.at(-1))).toMatchObject({
    target: 'context-target',
    selection: ['selected-other-message'],
    action: ['emit', 'target-delete'],
  });
  await expect(target).toBeFocused();
  await target.dispatchEvent('keydown', { key: 'ContextMenu', bubbles: true });
  await expect(byId(page, 'target-reply')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(target).toBeFocused();
  const prevented = await page.locator('#outside-target').evaluate(
    (node) =>
      !node.dispatchEvent(
        new window.MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
        })
      )
  );
  expect(prevented).toBe(false);
  await target.click({ button: 'right' });
  await expect(byId(page, 'target-menu')).toBeVisible();
});

test('long press touch opens; motion, pointerup and pointercancel cancel it', async ({
  page,
}) => {
  await freezeClock(page);
  const target = page.locator('#context-target');
  for (const cancel of ['pointerup', 'pointercancel', 'pointermove']) {
    await target.dispatchEvent('pointerdown', {
      pointerType: 'touch',
      clientX: 100,
      clientY: 200,
    });
    await target.dispatchEvent(cancel, {
      pointerType: 'touch',
      clientX: 150,
      clientY: 200,
    });
    await page.clock.fastForward(600);
    await expect(byId(page, 'target-menu')).toBeHidden();
  }
  await target.dispatchEvent('pointerdown', {
    pointerType: 'touch',
    clientX: 100,
    clientY: 200,
  });
  await page.clock.fastForward(599);
  await expect(byId(page, 'target-menu')).toBeHidden();
  await page.clock.fastForward(1);
  await expect(byId(page, 'target-menu')).toBeVisible();
});

test('tooltip delays, remains hoverable, closes with Escape and on blur', async ({
  page,
}) => {
  await freezeClock(page);
  const anchor = page.locator('#open-tooltip');
  const tip = byId(page, 'hint');
  await anchor.hover();
  await page.clock.fastForward(499);
  await expect(tip).toBeHidden();
  await page.clock.fastForward(1);
  await expect(tip).toBeVisible();
  await tip.hover();
  await page.clock.fastForward(200);
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await anchor.focus();
  await page.clock.fastForward(500);
  await expect(tip).toBeVisible();
  await page.locator('#outside-target').hover();
  await page.locator('#open-menu').focus();
  await page.clock.fastForward(100);
  await expect(tip).toBeHidden();
});

test('automatic and manual tabs keyboard activation', async ({ page }) => {
  await byId(page, 'first').focus();
  await page.keyboard.press('ArrowRight');
  await expect(byId(page, 'second')).toBeFocused();
  await expect(byId(page, 'advanced')).toBeVisible();
  await byId(page, 'manual-first').focus();
  await page.keyboard.press('ArrowRight');
  await expect(byId(page, 'manual-second')).toBeFocused();
  await expect(byId(page, 'overview')).toBeVisible();
  await expect(byId(page, 'history')).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(byId(page, 'history')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(byId(page, 'history')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(byId(page, 'overview')).toBeVisible();
});

test('toasts announce, preserve focus, bound queue, pause hover/focus and close', async ({
  page,
}) => {
  await freezeClock(page);
  const opener = page.locator('#add-toast');
  await opener.focus();
  const ids = await page.evaluate(() =>
    Array.from({ length: 4 }, () => window.addToast(false, 1000))
  );
  await expect(opener).toBeFocused();
  await expect(page.locator('#ui-live-region [role="status"]')).toHaveText(
    'Message saved'
  );
  await expect(byId(page, ids[3])).toBeHidden();
  const toast = byId(page, ids[0]);
  await page.clock.fastForward(300);
  await toast.hover();
  await page.clock.fastForward(700);
  await expect(toast).toBeVisible();
  await expect(byId(page, ids[3])).toBeVisible();
  const close = toast.getByRole('button', { name: 'Dismiss notification' });
  await close.focus();
  await opener.hover();
  await page.clock.fastForward(1000);
  await expect(toast).toBeVisible();
  await close.click();
  await expect(toast).toBeHidden();
  await page.evaluate(() => window.addToast(true, 0));
  await expect(page.locator('#ui-live-region [role="alert"]')).toHaveText(
    'Could not save message'
  );
});

for (const id of ['modal-drawer', 'docked-drawer']) {
  test(`${id} Escape returns focus`, async ({ page }) => {
    const opener = page.locator(
      id === 'modal-drawer' ? '#open-drawer' : '#open-docked'
    );
    await opener.click();
    await expect(byId(page, id)).toHaveAttribute(
      'aria-modal',
      String(id === 'modal-drawer')
    );
    await page.keyboard.press('Escape');
    await expect(byId(page, id)).toBeHidden();
    await expect(opener).toBeFocused();
  });
}

test('radial keyboard, horizontal labels/icons and 320px linear fallback', async ({
  page,
}) => {
  await page.locator('#open-radial').focus();
  await page.keyboard.press('Enter');
  const menu = byId(page, 'node-menu');
  const items = menu.getByRole('menuitem');
  await expect(items.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(items.nth(1)).toBeFocused();
  expect(
    await items.evaluateAll((nodes) =>
      nodes.every(
        (node) =>
          !node.style.transform.includes('rotate') &&
          node.querySelector('ui-icon > svg') &&
          !node.querySelector('ui-icon').hasAttribute('data-placeholder') &&
          window.getComputedStyle(node.querySelector('[data-part="label"]'))
            .transform === 'none'
      )
    )
  ).toBe(true);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.actions.at(-1).action)).toEqual([
    'emit',
    'insert',
  ]);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.locator('#open-radial').click();
  await expect(menu).toHaveAttribute('data-presentation', 'linear');
  const rect = await menu.boundingBox();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(320);
});

for (const id of [
  'closed',
  'confirm',
  'alert',
  'details',
  'hint',
  'message-menu',
  'submenu',
  'target-menu',
  'node-menu',
  'modal-drawer',
  'docked-drawer',
  'notifications',
]) {
  test(`accessible light/dark screenshots: ${id}`, async ({ page }) => {
    if (id === 'hint') {
      await page.locator('#open-tooltip').focus();
      await expect(byId(page, 'hint')).toBeVisible();
    } else if (id === 'notifications') {
      await page.evaluate(() => window.addToast(false, 0));
    } else if (id === 'target-menu') {
      await page.locator('#context-target').focus();
      await page.keyboard.press('Shift+F10');
    } else if (id === 'submenu') {
      await open(page, 'message-menu');
      await byId(page, 'more').focus();
      await page.keyboard.press('ArrowRight');
    } else if (id !== 'closed') {
      await open(page, id);
    }
    if (id !== 'closed' && id !== 'submenu') {
      await expect(byId(page, id)).toBeVisible();
    }
    await screenshotMatrix(page, `overlays-${id}`, {
      locales: ['en'],
      apply: async (page, { theme }) => {
        await page.emulateMedia({ colorScheme: theme });
      },
      afterScreenshot: (page) => expectAccessible(page),
    });
  });
}

test('matrix audits settled theme colors and still rejects settled contrast defects', async ({
  page,
}) => {
  await open(page, 'node-menu');
  const checked = [];
  await screenshotMatrix(page, 'overlays-node-menu', {
    locales: ['en'],
    apply: async (page, { theme }) => {
      await page.emulateMedia({ colorScheme: theme });
      // Hold a theme background at the reported gray until screenshot capture
      // finishes the animation, exposing premature accessibility audits.
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.cancel();
        }
        for (const surface of document.querySelectorAll(
          '[data-link-id="node-menu"] > [role="menuitem"]'
        )) {
          const backgroundColor =
            window.getComputedStyle(surface).backgroundColor;
          const animation = surface.animate(
            [{ backgroundColor: '#7d7d7d' }, { backgroundColor }],
            { duration: 60_000, fill: 'forwards' }
          );
          animation.pause();
          animation.currentTime = 0;
        }
      });
      if (theme === 'dark') {
        expect((await axeViolations(page)).map(({ id }) => id)).toContain(
          'color-contrast'
        );
      }
    },
    afterScreenshot: async (page, { theme }) => {
      checked.push(theme);
      await expectAccessible(page);
    },
  });
  expect(checked).toEqual(['light', 'dark']);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.cancel();
    }
  });
  await page.addStyleTag({
    content:
      '[data-link-id="node-menu"] > [role="menuitem"] { color: white !important; background: #7d7d7d !important; }',
  });
  await expect(expectAccessible(page)).rejects.toThrow(/color-contrast/);
});
