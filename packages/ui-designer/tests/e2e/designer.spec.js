import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const PAGE = '/packages/ui-designer/examples/index.html';
const canvasNode = (page, id) =>
  page.locator(`.designer-canvas [data-link-id="${id}"]`);
const source = (page) =>
  page.getByRole('textbox', { name: 'LiNo source', exact: true });
const selected = (page) => page.locator('.designer-canvas [data-selected]');
const outlineItem = (page, id) =>
  page.locator(`[role=treeitem][data-id="${id}"] > .outline-row`);
const text = (page) => page.evaluate(() => window.designer.getText());
const historyLength = (page) =>
  page.evaluate(() => window.designer.store.log().length);
const canvasFocus = (page) =>
  page.getByRole('region', { name: 'Design canvas', exact: true }).focus();

async function undoRedo(page, before, after) {
  await canvasFocus(page);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => text(page)).toBe(before);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect.poll(() => text(page)).toBe(after);
}
async function drag(page, from, to, fraction = 0.5) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height * fraction, {
    steps: 6,
  });
}
async function shot(page, info, name) {
  await info.attach(name, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: async (value) => {
          window.designerClipboard = value;
        },
        readText: async () => window.designerClipboard ?? '',
      },
    });
  });
  await page.goto(PAGE);
  await expect(canvasNode(page, 'ok')).toBeVisible();
});

test('M1: dock layout resizes, collapses and persists in the user layer; design/run dispatch', async ({
  page,
}, info) => {
  const left = page.locator('[data-link-id=left-dock] .ui-dock-region');
  const divider = page.getByRole('separator', {
    name: 'Resize Toolbox and Outline',
  });
  await divider.focus();
  const before = await left.boundingBox();
  await page.keyboard.press('Shift+ArrowRight');
  await expect
    .poll(async () => (await left.boundingBox()).width)
    .toBeGreaterThan(before.width);
  await page.locator('[data-link-id=left-dock] .ui-tab-actions').click();
  await page.getByRole('menuitem', { name: /Collapse/ }).click();
  await page.reload();
  await expect(left).toHaveAttribute('data-collapsed', '');
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem('link-ui-designer.user')
    )
  ).toContain('horizontal');
  await page.locator('[data-link-id=left-dock] .ui-tab-actions').click();
  await page
    .getByRole('menuitem', { name: 'Expand region', exact: true })
    .click();
  await canvasNode(page, 'ok').click();
  expect(await page.evaluate(() => window.lastDesignerAction)).toBeUndefined();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await canvasNode(page, 'ok').getByRole('button').click();
  await expect
    .poll(() => page.evaluate(() => window.lastDesignerAction))
    .toEqual(['navigate', 'home']);
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  await shot(page, info, 'M1-shell');
});

test('M2: toolbox pointer insertion on canvas and Outline, refused leaf drop, atomic history', async ({
  page,
}, info) => {
  const before = await text(page);
  await drag(
    page,
    page.locator('[data-component=text]'),
    canvasNode(page, 'ok'),
    0.1
  );
  await expect(page.locator('[data-drop=allowed]')).toBeVisible();
  await page.mouse.up();
  await expect(canvasNode(page, 'text-1')).toBeVisible();
  expect(await historyLength(page)).toBe(1);
  const after = await text(page);
  expect(after.indexOf('text-1:')).toBeLessThan(after.indexOf('ok:'));
  expect(after).toContain('# Greeting stays');
  await undoRedo(page, before, after);
  const beforeOutline = await text(page);
  await page.getByRole('tab', { name: 'Outline', exact: true }).click();
  await page.getByRole('tab', { name: 'Toolbox', exact: true }).click();
  // Keep the toolbox drag alive while opening the Outline tab.
  const item = page.locator('[data-component=button]');
  const box = await item.boundingBox();
  await page.mouse.move(box.x + 25, box.y + 10);
  await page.mouse.down();
  await page.getByRole('tab', { name: 'Outline', exact: true }).hover();
  const target = await outlineItem(page, 'body').boundingBox();
  await page.mouse.move(target.x + 50, target.y + target.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(canvasNode(page, 'button-1')).toBeVisible();
  await undoRedo(page, beforeOutline, await text(page));
  const accepted = await text(page);
  await page.getByRole('tab', { name: 'Toolbox', exact: true }).click();
  await drag(
    page,
    page.locator('[data-component=text]'),
    canvasNode(page, 'ok')
  );
  await expect(page.locator('[data-drop=refused]')).toBeVisible();
  await shot(page, info, 'M2-refused-drop');
  await page.mouse.up();
  expect(await text(page)).toBe(accepted);
});

for (const layout of ['stack', 'grid']) {
  test(`flow insertion marks the horizontal ${layout} slot and commits once`, async ({
    page,
  }) => {
    await source(page).fill(`app: document
  body: ${layout}
    ${layout === 'stack' ? 'direction horizontal' : 'columns 1fr 1fr'}
    a: text A
    b: text B
`);
    const before = await text(page);
    const count = await historyLength(page);
    const from = await page.locator('[data-component=text]').boundingBox();
    const to = await canvasNode(page, 'b').boundingBox();
    await page.mouse.move(from.x + 10, from.y + 10);
    await page.mouse.down();
    await page.mouse.move(to.x + 1, to.y + to.height / 2, { steps: 5 });
    const indicator = page.locator('[data-drop=allowed]');
    await expect(indicator).toBeVisible();
    const line = await indicator.boundingBox();
    expect(line.width).toBeLessThan(line.height);
    await page.mouse.up();
    expect(
      await page.evaluate(() => window.designer.store.children('body'))
    ).toEqual(['a', 'text-1', 'b']);
    expect(await historyLength(page)).toBe(count + 1);
    await undoRedo(page, before, await text(page));
  });
}

test('M2: canvas and Outline move, range/toggle selection, duplicate/delete and clipboard each undo once', async ({
  page,
}) => {
  await canvasNode(page, 'greeting').click();
  await canvasNode(page, 'ok').click({ modifiers: ['ControlOrMeta'] });
  await expect(selected(page)).toHaveCount(2);
  let before = await text(page);
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(selected(page)).toHaveCount(2);
  const copies = await selected(page).evaluateAll((nodes) =>
    nodes.map((n) => n.dataset.linkId)
  );
  await undoRedo(page, before, await text(page));
  for (const [i, id] of copies.entries()) {
    await canvasNode(page, id).click({ modifiers: i ? ['ControlOrMeta'] : [] });
  }
  before = await text(page);
  await page.keyboard.press('Delete');
  await undoRedo(page, before, await text(page));
  await canvasNode(page, 'greeting').click();
  await canvasFocus(page);
  await page.keyboard.press('ControlOrMeta+c');
  await page.getByRole('tab', { name: 'Outline', exact: true }).click();
  await outlineItem(page, 'body').click();
  before = await text(page);
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(() => text(page)).not.toBe(before);
  await undoRedo(page, before, await text(page));
  await outlineItem(page, 'greeting').click();
  before = await text(page);
  await page.keyboard.press('ControlOrMeta+x');
  await expect.poll(() => text(page)).not.toBe(before);
  await undoRedo(page, before, await text(page));
  await page.keyboard.press('ControlOrMeta+z');
  await page.getByRole('tab', { name: 'Outline', exact: true }).click();
  await outlineItem(page, 'greeting').click();
  await outlineItem(page, 'ok').click({ modifiers: ['Shift'] });
  await expect(selected(page)).toHaveCount(2);
  await outlineItem(page, 'greeting').click();
  before = await text(page);
  await drag(page, outlineItem(page, 'greeting'), outlineItem(page, 'details'));
  await page.mouse.up();
  expect(
    await page.evaluate(() => window.designer.store.parentOf('greeting'))
  ).toBe('details');
  await undoRedo(page, before, await text(page));
  before = await text(page);
  await drag(page, canvasNode(page, 'ok'), canvasNode(page, 'hint'), 0.9);
  await page.mouse.up();
  expect(await page.evaluate(() => window.designer.store.parentOf('ok'))).toBe(
    'details'
  );
  await undoRedo(page, before, await text(page));
});

test('M3: sibling guides, cancelled pointer capture, marquee, resize and 1/10px nudge', async ({
  page,
}, info) => {
  let before = await text(page);
  const rect = await canvasNode(page, 'ok').boundingBox();
  await page.mouse.move(rect.x + 10, rect.y + 10);
  await page.mouse.down();
  await page.mouse.move(rect.x + 13, rect.y + 25, { steps: 4 });
  await expect(page.locator('.designer-guide').first()).toBeVisible();
  await shot(page, info, 'M3-guides');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(await text(page)).toBe(before);
  await canvasNode(page, 'ok').click();
  const resize = page.getByRole('button', { name: /^Resize ok;/ });
  const bounds = await resize.boundingBox();
  await page.mouse.move(bounds.x + 5, bounds.y + 5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 25, bounds.y + 15, { steps: 5 });
  await page.mouse.up();
  expect(await text(page)).toContain('width 140px');
  await undoRedo(page, before, await text(page));
  before = await text(page);
  await canvasFocus(page);
  await page.keyboard.press('ArrowRight');
  expect(await text(page)).toContain('x 1');
  await page.keyboard.press('Shift+ArrowDown');
  expect(await text(page)).toContain('y 10');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await text(page)).not.toContain('y 10');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await text(page)).toBe(before);
  const area = await page.locator('.designer-canvas').boundingBox();
  await page.mouse.move(area.x + area.width - 5, area.y + area.height - 5);
  await page.mouse.down();
  await page.mouse.move(area.x + 5, area.y + 5, { steps: 5 });
  await page.mouse.up();
  expect(await selected(page).count()).toBeGreaterThan(1);
});

test('M4: property and source edits retain bytes and IDs; errors keep the canvas; draft reload', async ({
  page,
}, info) => {
  await canvasNode(page, 'greeting').click();
  const before = await text(page);
  const editor = page
    .locator('[data-link-id=properties]')
    .getByRole('textbox', { name: 'value', exact: true });
  await editor.fill('Edited');
  await editor.press('Tab');
  expect(await historyLength(page)).toBe(1);
  await expect(canvasNode(page, 'greeting')).toHaveText('Edited');
  await undoRedo(page, before, await text(page));
  const valid = (await text(page)).replace('Edited', 'Source edit');
  await source(page).fill(valid);
  await expect(canvasNode(page, 'greeting')).toHaveText('Source edit');
  await source(page).fill(`${valid}\n(`);
  await expect(page.getByRole('alert')).toContainText(/Line \d+, column \d+/);
  await expect(canvasNode(page, 'greeting')).toHaveText('Source edit');
  expect(await text(page)).toBe(valid);
  await shot(page, info, 'M4-source-error');
  await source(page).fill(valid);
  await page.reload();
  await expect(canvasNode(page, 'greeting')).toHaveText('Source edit');
});

test('keyboard-only insert, Outline reorder, resize, clipboard, open, save and source copy', async ({
  page,
}) => {
  await page.getByRole('tab', { name: 'Outline', exact: true }).focus();
  await page.keyboard.press('Enter');
  const first = page.locator('[role=treeitem]').first();
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[role=treeitem][data-id=body]')).toBeFocused();
  await page.getByRole('tab', { name: 'Toolbox', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-component=text]').focus();
  await page.keyboard.press('Enter');
  await expect(canvasNode(page, 'text-1')).toBeVisible();
  let before = await text(page);
  await page.getByRole('tab', { name: 'Outline', exact: true }).click();
  await outlineItem(page, 'text-1').click();
  await page.keyboard.press('Alt+ArrowUp');
  await undoRedo(page, before, await text(page));
  await canvasNode(page, 'ok').click();
  before = await text(page);
  await page.getByRole('button', { name: /^Resize ok;/ }).focus();
  await page.keyboard.press('Shift+ArrowRight');
  expect(await text(page)).toContain('width 130px');
  await undoRedo(page, before, await text(page));
  const upload = 'app: document\n  imported: text Imported\n';
  await page.getByLabel('Open LiNo file').setInputFiles({
    name: 'opened.lino',
    mimeType: 'text/plain',
    buffer: Buffer.from(upload),
  });
  await expect(canvasNode(page, 'imported')).toHaveText('Imported');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = await download;
  expect(await readFile(await saved.path(), 'utf8')).toBe(upload);
  await page.getByRole('button', { name: 'Copy source', exact: true }).click();
  expect(await page.evaluate(() => window.designerClipboard)).toBe(upload);
});

for (const scheme of ['light', 'dark']) {
  test(`designer is accessible in ${scheme} mode, including typed properties and source errors`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await canvasNode(page, 'ok').click();
    await expectAccessible(page);
    await page.getByRole('tab', { name: 'Outline', exact: true }).click();
    await source(page).fill(`${await text(page)}\n(`);
    await expectAccessible(page);
  });
}
