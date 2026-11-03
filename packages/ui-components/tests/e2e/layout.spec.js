/**
 * The layout kinds of @link-foundation/ui-components in a real browser,
 * on the gallery page examples/layout.html:
 *
 * - a split remembers its sizes across a reload;
 * - every divider, tab strip, window and dock region works keyboard-only
 *   (reached with Tab, driven with the keys of its WAI-ARIA pattern);
 * - a window cannot be dragged outside the viewport;
 * - the app shell is a bottom bar, a rail and a drawer at 600, 800 and
 *   1280px (screenshots);
 * - the designer dock before and after moving the outline to the right
 *   (screenshots);
 * - axe-core reports no WCAG 2.2 A/AA violations.
 *
 * With LAYOUT_DOCS_SCREENSHOTS=1 the screenshots are also written to
 * docs/screenshots/issue-36/ for the documentation.
 */
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const PAGE = 'packages/ui-components/examples/layout.html';
const DOCS_DIR = join(
  import.meta.dirname,
  '../../../../docs/screenshots/issue-36'
);

/** Also save a screenshot for the docs (chromium only, on request). */
async function docsShot(target, name, testInfo, options = {}) {
  if (
    process.env.LAYOUT_DOCS_SCREENSHOTS &&
    testInfo.project.name === 'chromium'
  ) {
    await target.screenshot({ path: join(DOCS_DIR, name), ...options });
  }
}

async function openGallery(page, width = 1280) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(PAGE);
  await page.locator('#app[data-ready=true]').waitFor();
}

/** Press Tab until the focused element matches `selector`. */
async function tabTo(page, selector, limit = 60) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    if (
      await page.evaluate(
        (s) => document.activeElement?.matches(s) ?? false,
        selector
      )
    ) {
      return;
    }
  }
  throw new Error(`Tab never reached ${selector}`);
}

const focused = (page) => page.locator(':focus');
const divider = (page) =>
  page.locator('[data-link-id=chat] > [role=separator]');
const tabs = (page, group) =>
  page.locator(`[data-link-id=${group}] [role=tablist] [role=tab]`);
const regionTabs = (page, side) =>
  page.locator(`.ui-dock-region[data-side=${side}] [role=tab]`);
const inspector = (page) => page.locator('ui-window[data-link-id=inspector]');

test.describe('layout gallery: keyboard and persistence', () => {
  test('a split remembers its sizes across a reload', async ({ page }) => {
    await openGallery(page);
    await expect(divider(page)).toHaveAttribute('aria-valuenow', '30');
    await tabTo(page, '[data-link-id=chat] > [role=separator]');
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(divider(page)).toHaveAttribute('aria-valuenow', '41');
    expect(
      await page.evaluate(() => globalThis.localStorage.getItem('gallery.chat'))
    ).toBe('(sizes 41 59)');
    const before = await page.locator('[data-link-id=chat-list]').boundingBox();

    await page.reload();
    await page.locator('#app[data-ready=true]').waitFor();
    await expect(divider(page)).toHaveAttribute('aria-valuenow', '41');
    const after = await page.locator('[data-link-id=chat-list]').boundingBox();
    expect(Math.round(after.width)).toBe(Math.round(before.width));
  });

  test('a split divider works keyboard-only', async ({ page }) => {
    await openGallery(page);
    await tabTo(page, '[data-link-id=chat] > [role=separator]');
    // The first pane is collapsible, so the divider reaches 0.
    await expect(divider(page)).toHaveAttribute('aria-valuemin', '0');
    await expect(divider(page)).toHaveAttribute('aria-label', 'Resize Chats');
    await page.keyboard.press('ArrowRight');
    await expect(divider(page)).toHaveAttribute('aria-valuenow', '31');
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(divider(page)).toHaveAttribute('aria-valuenow', '21');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(divider(page)).toHaveAttribute('aria-valuenow', '20');
    await page.keyboard.press('End');
    await expect(divider(page)).toHaveAttribute('aria-valuenow', '80');
    // The first pane is collapsible: Home collapses it, Enter restores it.
    await page.keyboard.press('Home');
    await expect(divider(page)).toHaveAttribute('aria-valuenow', '0');
    await page.keyboard.press('Enter');
    await expect(divider(page)).toHaveAttribute('aria-valuenow', '80');
    await expect(divider(page)).toBeFocused();
  });

  test('a tab strip works keyboard-only', async ({ page }) => {
    await openGallery(page);
    const strip = tabs(page, 'inspector-tabs');
    await expect(strip).toHaveText(['Styles×', 'Events×', 'Data×']);
    await tabTo(page, '[data-link-id=inspector-tabs] [role=tab]');
    await expect(focused(page)).toHaveText('Styles×');
    await page.keyboard.press('ArrowRight');
    await expect(strip.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(strip.nth(1)).toBeFocused();
    await expect(page.locator('[data-link-id=events]:visible')).toHaveAttribute(
      'role',
      'tabpanel'
    );
    await page.keyboard.press('End');
    await expect(strip.nth(2)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(strip.nth(0)).toBeFocused();
    // Ctrl+Shift+Arrow moves the tab; Delete closes it.
    await page.keyboard.press('Control+Shift+ArrowRight');
    await expect(strip).toHaveText(['Events×', 'Styles×', 'Data×']);
    await expect(focused(page)).toHaveText('Styles×');
    await page.keyboard.press('Delete');
    await expect(strip).toHaveText(['Events×', 'Data×']);
    await expect(focused(page)).toHaveAttribute('role', 'tab');
  });

  test('a window works keyboard-only', async ({ page }) => {
    await openGallery(page);
    await expect(inspector(page)).toBeHidden();
    await tabTo(page, '[data-link-id=open-window] button');
    await page.keyboard.press('Enter');
    await expect(inspector(page)).toBeVisible();
    await expect(page.locator('ui-window:focus-within')).toHaveCount(1);
    const start = await inspector(page).boundingBox();
    await page.keyboard.press('Alt+ArrowRight');
    await page.keyboard.press('Alt+ArrowDown');
    await expect
      .poll(async () => (await inspector(page).boundingBox()).x)
      .toBe(start.x + 16);
    expect((await inspector(page).boundingBox()).y).toBe(start.y + 16);
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await expect
      .poll(async () => (await inspector(page).boundingBox()).width)
      .toBe(start.width + 16);
    await page.keyboard.press('Escape');
    await expect(inspector(page)).toBeHidden();
    await expect(
      page.locator('[data-link-id=open-window] button')
    ).toBeFocused();
  });

  test('a dock works keyboard-only', async ({ page }, testInfo) => {
    await openGallery(page);
    const designer = page.locator('[data-link-id=designer]');
    await expect(regionTabs(page, 'left')).toHaveText(['Toolbox×', 'Outline×']);
    await expect(regionTabs(page, 'right')).toHaveText(['Properties×']);
    await expect(regionTabs(page, 'center')).toHaveText(['Canvas']);
    await expect(designer).toHaveScreenshot('dock-designer.png');
    await docsShot(designer, 'dock-designer.png', testInfo);

    await tabTo(page, '.ui-dock-region[data-side=left] [role=tab]');
    await page.keyboard.press('ArrowRight');
    await expect(focused(page)).toHaveText('Outline×');
    await tabTo(page, '.ui-dock-region[data-side=left] .ui-tab-actions');
    await page.keyboard.press('Enter');
    await expect(page.locator('[role=menuitem]:focus')).toHaveText(
      'Move to right'
    );
    await page.keyboard.press('Enter');
    await expect(regionTabs(page, 'left')).toHaveText(['Toolbox×']);
    await expect(regionTabs(page, 'right')).toHaveText([
      'Properties×',
      'Outline×',
    ]);
    await expect(focused(page)).toHaveText('Outline×');
    expect(
      await page.evaluate(() =>
        globalThis.localStorage.getItem('gallery.designer')
      )
    ).toContain('outline');

    // Ctrl+F6 goes to the next open panel, Ctrl+Shift+F6 back.
    await page.keyboard.press('Control+F6');
    await expect(focused(page)).toHaveText('Canvas');
    await page.keyboard.press('Control+Shift+F6');
    await expect(focused(page)).toHaveText('Outline×');
    await page.evaluate(() => document.activeElement?.blur());
    await expect(designer).toHaveScreenshot('dock-designer-outline-right.png');
    await docsShot(designer, 'dock-designer-outline-right.png', testInfo);

    // The moved panel stays on the right after a reload.
    await page.reload();
    await page.locator('#app[data-ready=true]').waitFor();
    await expect(regionTabs(page, 'right')).toHaveText([
      'Properties×',
      'Outline×',
    ]);
  });
});

test.describe('layout gallery: viewport and accessibility', () => {
  test('a window cannot be dragged outside the viewport', async ({ page }) => {
    await openGallery(page);
    await page.locator('[data-link-id=open-window] button').click();
    const header = inspector(page).locator('.ui-window-title');
    await expect(header).toBeVisible();
    const viewport = page.viewportSize();
    for (const [x, y] of [
      [-2000, -2000],
      [viewport.width + 2000, viewport.height + 2000],
      [-2000, viewport.height + 2000],
    ]) {
      const box = await header.boundingBox();
      await page.mouse.move(box.x + 20, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(x, y, { steps: 5 });
      await page.mouse.up();
      const win = await inspector(page).boundingBox();
      expect(win.x).toBeGreaterThanOrEqual(0);
      expect(win.y).toBeGreaterThanOrEqual(0);
      expect(win.x + win.width).toBeLessThanOrEqual(viewport.width);
      expect(win.y + win.height).toBeLessThanOrEqual(viewport.height);
    }
    // It reached the bottom-left corner, so it did move.
    const win = await inspector(page).boundingBox();
    expect(win.x).toBe(0);
    expect(Math.round(win.y + win.height)).toBe(viewport.height);
  });

  for (const [width, mode] of [
    [600, 'bottom-bar'],
    [800, 'rail'],
    [1280, 'drawer'],
  ]) {
    test(`the app shell is a ${mode} at ${width}px`, async ({
      page,
    }, testInfo) => {
      await openGallery(page, width);
      const shell = page.locator('ui-app-shell');
      await expect(shell).toHaveAttribute('mode', mode);
      const nav = page.getByRole('navigation');
      await expect(nav).toBeVisible();
      // The shell sets the axis of the navigation, and every item fits in it.
      await expect(nav).toHaveCSS(
        'flex-direction',
        mode === 'bottom-bar' ? 'row' : 'column'
      );
      const navBox = await nav.boundingBox();
      for (const item of await nav.locator('button').all()) {
        const box = await item.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(navBox.x);
        expect(box.x + box.width).toBeLessThanOrEqual(navBox.x + navBox.width);
      }
      if (mode === 'bottom-bar') {
        expect(Math.round(navBox.y + navBox.height)).toBe(800);
      }
      // The dock center keeps its minimum width (12rem) at every width.
      const center = await page
        .locator('.ui-dock-region[data-side=center]')
        .boundingBox();
      expect(center.width).toBeGreaterThanOrEqual(192);
      await expect(page).toHaveScreenshot(`app-shell-${width}.png`, {
        fullPage: true,
      });
      await docsShot(page, `app-shell-${width}.png`, testInfo, {
        fullPage: true,
      });
    });
  }

  test('has no axe violations', async ({ page }) => {
    await openGallery(page);
    await expectAccessible(page);
    // With the window open and a menu open too.
    await page.locator('[data-link-id=open-window] button').click();
    await expect(inspector(page)).toBeVisible();
    await page
      .locator('.ui-dock-region[data-side=left] .ui-tab-actions')
      .click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expectAccessible(page);
  });

  test('has no axe violations as a bottom bar', async ({ page }) => {
    await openGallery(page, 600);
    await expectAccessible(page);
  });
});
