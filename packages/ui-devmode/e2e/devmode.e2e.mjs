/**
 * Dev mode in a real browser: the example page renders the issue-1 sample
 * with ui-dom and mounts dev mode with the site policy of the issue.
 *
 * `UPDATE_DOCS_SCREENSHOTS=1` also writes the inspector screenshot of the
 * documentation (docs/screenshots/ui-devmode-inspector.png).
 */
import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { expectAccessible } from '../../../tests/ui/helpers.mjs';

const PAGE = 'packages/ui-devmode/examples/';
const LAZY_MODULES = [
  'session.js',
  'inspector.js',
  'overlay.js',
  'model.js',
  'views.js',
  'editors.js',
];

/**
 * Wait for the first render and, when `?ui-dev` opens dev mode, for its
 * global handle: the inspector is loaded with a dynamic `import()` after the
 * page is ready.
 */
async function waitForPage(page, query) {
  await page.waitForSelector('#app[data-ready="true"]');
  if (query.includes('ui-dev') && !query.includes('policy=disabled')) {
    await page.waitForFunction(() => 'linkUiDevMode' in globalThis);
  }
}

/** Open the example and wait for the first render. */
async function openExample(page, query = '') {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${PAGE}${query}`);
  await waitForPage(page, query);
  return errors;
}

const inspector = (page) => page.locator('ui-devmode-inspector');
const isOpen = (page) => page.evaluate(() => 'linkUiDevMode' in globalThis);
const okButton = (page) => page.locator('#app [data-link-id="ok"] button');
const row = (page, name) => inspector(page).locator(`tr[data-name="${name}"]`);
const selection = (page) =>
  page.evaluate(() => globalThis.linkUiDevMode.getSelection());

test.beforeEach(async ({ page }) => {
  // Each test starts without saved changes.
  await page.addInitScript(() => {
    if (!globalThis.sessionStorage.getItem('devmode-e2e')) {
      globalThis.sessionStorage.setItem('devmode-e2e', '1');
      globalThis.localStorage.clear();
    }
  });
});

test('?ui-dev opens dev mode and Alt+Shift+D toggles it', async ({ page }) => {
  const errors = await openExample(page, '?ui-dev');
  await expect(inspector(page).getByRole('complementary')).toBeVisible();
  expect(await isOpen(page)).toBe(true);
  await page.keyboard.press('Alt+Shift+KeyD');
  await expect(inspector(page)).toHaveCount(0);
  expect(await isOpen(page)).toBe(false);
  await page.keyboard.press('Alt+Shift+KeyD');
  await expect(inspector(page).getByRole('complementary')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the shortcut does nothing in a text input', async ({ page }) => {
  await openExample(page);
  await page.locator('#notes').focus();
  await page.keyboard.press('Alt+Shift+KeyD');
  await page.waitForTimeout(200);
  await expect(inspector(page)).toHaveCount(0);
  await page.locator('h1').click();
  await page.keyboard.press('Alt+Shift+KeyD');
  await expect(inspector(page).getByRole('complementary')).toBeVisible();
});

test('a disabled policy never requests the inspector modules', async ({
  page,
}) => {
  const requested = [];
  page.on('request', (request) => requested.push(request.url()));
  await openExample(page, '?ui-dev&policy=disabled');
  await page.locator('h1').click();
  await page.keyboard.press('Alt+Shift+KeyD');
  await page.waitForTimeout(300);
  await expect(inspector(page)).toHaveCount(0);
  expect(await isOpen(page)).toBe(false);
  const devmode = requested
    .filter((url) => url.includes('/packages/ui-devmode/src/'))
    .map((url) => url.split('/').at(-1));
  expect(devmode.includes('index.js')).toBe(true);
  for (const name of LAZY_MODULES) {
    expect(devmode).not.toContain(name);
  }
  expect(devmode.some((url) => url.endsWith('.lino'))).toBe(false);
});

test('hover labels ok and a click selects it without the press', async ({
  page,
}) => {
  const errors = await openExample(page, '?ui-dev');
  await okButton(page).hover();
  const hover = page.locator('ui-devmode-overlay [data-box="hover"]');
  await expect(hover).toBeVisible();
  await expect(hover.locator('.label')).toHaveText('ok: button');
  const pointer = await hover.evaluate(
    (box) => globalThis.getComputedStyle(box).pointerEvents
  );
  expect(pointer).toBe('none');
  await okButton(page).click();
  expect(await selection(page)).toEqual({ id: 'ok', type: 'button' });
  await expect(page.locator('#action')).toHaveText('none');
  await expect(
    page.locator('ui-devmode-overlay [data-box="selected"] .label')
  ).toHaveText('ok: button');
  // Escape leaves pick mode: the app gets its press again.
  await page.keyboard.press('Escape');
  expect(await isOpen(page)).toBe(true);
  await okButton(page).click();
  await expect(page.locator('#action')).toHaveText(
    'ok press → (navigate home)'
  );
  // A second Escape closes.
  await page.keyboard.press('Escape');
  await expect(inspector(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the outline shows app > body > greeting, ok and selects', async ({
  page,
}) => {
  await openExample(page, '?ui-dev');
  const tree = inspector(page).getByRole('tree');
  const items = tree.getByRole('treeitem');
  await expect(items).toHaveCount(4);
  const ids = await items.evaluateAll((nodes) =>
    nodes.map((n) => `${n.getAttribute('aria-level')}:${n.dataset.id}`)
  );
  expect(ids).toEqual(['1:app', '2:body', '3:greeting', '3:ok']);
  await tree.locator('[data-id="greeting"] > .row').click();
  expect(await selection(page)).toEqual({ id: 'greeting', type: 'text' });
  await expect(tree.locator('[data-id="greeting"]')).toHaveAttribute(
    'aria-selected',
    'true'
  );
  // Keyboard: the selection follows the focus.
  await page.keyboard.press('ArrowDown');
  expect(await selection(page)).toEqual({ id: 'ok', type: 'button' });
  await page.keyboard.press('Home');
  expect(await selection(page)).toEqual({ id: 'app', type: 'document' });
  await okButton(page).click();
  await expect(tree.locator('[data-id="ok"]')).toHaveAttribute(
    'aria-selected',
    'true'
  );
});

test('a label edit is live, saved to user, kept on reload and reset to site', async ({
  page,
}) => {
  await openExample(page, '?ui-dev');
  await okButton(page).click();
  await inspector(page).getByRole('tab', { name: 'Properties' }).click();
  const label = row(page, 'label');
  await expect(label).toHaveAttribute('data-layer', 'site');
  await label.getByRole('textbox', { name: 'label' }).fill('Okay');
  await expect(okButton(page)).toHaveText('Okay');
  await expect(label).toHaveAttribute('data-layer', 'session');
  await expect(label).toHaveClass(/is-changed/);

  await inspector(page).getByRole('button', { name: 'Save' }).click();
  await expect(label).toHaveAttribute('data-layer', 'user');

  await page.reload();
  await waitForPage(page, '?ui-dev');
  await expect(okButton(page)).toHaveText('Okay');
  await page.evaluate(() => globalThis.linkUiDevMode.select('ok'));
  await inspector(page).getByRole('tab', { name: 'Properties' }).click();
  await expect(label).toHaveAttribute('data-layer', 'user');

  await label.getByRole('button', { name: 'Reset label' }).click();
  await expect(label).toHaveAttribute('data-layer', 'site');
  await expect(okButton(page)).toHaveText('OK');
  await expect(label).not.toHaveClass(/is-changed/);
});

test('setProperty applies to the session; locked elements are read-only', async ({
  page,
}) => {
  await openExample(page, '?ui-dev&lock=body');
  await page.evaluate(() => globalThis.linkUiDevMode.select('ok'));
  await inspector(page).getByRole('tab', { name: 'Properties' }).click();
  const label = row(page, 'label');
  await expect(label).toHaveClass(/is-locked/);
  await expect(label.getByRole('textbox', { name: 'label' })).toBeDisabled();
  const error = await page.evaluate(() => {
    try {
      globalThis.linkUiDevMode.setProperty('ok', 'label', 'X');
      return null;
    } catch (e) {
      return e.code;
    }
  });
  expect(error).toBe('locked-element');
  const layer = await page.evaluate(
    () => globalThis.linkUiDevMode.setProperty('app', 'title', 'Edited').layer
  );
  expect(layer).toBe('session');
});

test('the inspector passes axe and is keyboard-usable', async ({ page }) => {
  await openExample(page, '?ui-dev');
  await okButton(page).click();
  await page.keyboard.press('Escape');
  const tabs = inspector(page).getByRole('tab');
  for (const name of [
    'Outline',
    'Properties',
    'Styles',
    'Tokens',
    'Animations',
    'Source',
  ]) {
    await tabs.filter({ hasText: name }).click();
    await expectAccessible(page, { include: 'ui-devmode-inspector' });
  }
  // The dark colour scheme keeps the contrast.
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const name of ['Outline', 'Properties']) {
    await tabs.filter({ hasText: name }).click();
    await expectAccessible(page, { include: 'ui-devmode-inspector' });
  }
  await page.emulateMedia({ colorScheme: 'light' });
  // The tabs follow the arrow keys.
  await tabs.filter({ hasText: 'Outline' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.filter({ hasText: 'Properties' })).toBeFocused();
  await expect(tabs.filter({ hasText: 'Properties' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  // Tab moves from the selected tab into its panel, then its editors.
  await page.keyboard.press('Tab');
  await expect(inspector(page).getByRole('tabpanel')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    row(page, 'label').getByRole('textbox', { name: 'label' })
  ).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect(okButton(page)).toHaveText('OK!');
  // The toolbar works from the keyboard; Escape closes from inside.
  const pick = inspector(page).getByRole('button', { name: 'Pick element' });
  await pick.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(pick).not.toBeFocused();
  await page.keyboard.press('Tab');
  await expect(pick).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(pick).toHaveAttribute('aria-pressed', 'true');
  await inspector(page).getByRole('button', { name: 'Discard' }).focus();
  await page.keyboard.press('Enter');
  await expect(okButton(page)).toHaveText('OK');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(inspector(page)).toHaveCount(0);
});

test('screenshot of the inspector with ok selected', async ({
  page,
}, testInfo) => {
  await openExample(page, '?ui-dev');
  await okButton(page).click();
  await inspector(page).getByRole('tab', { name: 'Properties' }).click();
  await row(page, 'label').getByRole('textbox', { name: 'label' }).fill('Okay');
  await expect(row(page, 'label')).toHaveAttribute('data-layer', 'session');
  await okButton(page).hover();
  const shot = await page.screenshot();
  await testInfo.attach('inspector', { body: shot, contentType: 'image/png' });
  if (
    process.env.UPDATE_DOCS_SCREENSHOTS === '1' &&
    testInfo.project.name === 'chromium'
  ) {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.screenshot({
      path: 'docs/screenshots/ui-devmode-inspector.png',
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({
      path: 'docs/screenshots/ui-devmode-inspector-dark.png',
    });
  }
});
