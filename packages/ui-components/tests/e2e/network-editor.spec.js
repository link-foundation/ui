import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const path = '/packages/ui-components/examples/network-editor.html';
async function open(page) {
  await page.goto(path);
  await page.waitForFunction(() => globalThis.networkEditorExample);
}
async function ready(page) {
  await page.evaluate(() => globalThis.networkEditorExample.editor.ready);
}

test('notations edit the presentation, invalid bases preserve preview, and controls are accessible', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('number', { exact: true }).fill('0120₃');
  await ready(page);
  await expect(page.getByLabel('pairs', { exact: true })).toHaveValue('01 20');
  await expect(page.getByLabel('theory', { exact: true })).toHaveValue(
    'λ = {1 ↦ (0, 1), 2 ↦ (2, 0)}'
  );
  await expect(page.getByLabel('links', { exact: true })).toHaveValue(
    '(1: 0 1) (2: 2 0)'
  );
  const before = await page.locator('#preview').innerHTML();
  await page.getByLabel('number', { exact: true }).fill('0120₄');
  await ready(page);
  await expect(page.getByLabel('number', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true'
  );
  await expect(page.locator('#editor-number-error')).toContainText('base');
  expect(await page.locator('#preview').innerHTML()).toBe(before);
  await page.getByLabel('number', { exact: true }).fill('0120₃');
  await ready(page);
  await expectAccessible(page);
  await expect(
    page.getByRole('group', { name: 'Notations', exact: true })
  ).toHaveScreenshot('network-editor-notations.png');
});

test('URL writes wait for slider release and preserve or clear pinned frames', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    globalThis.urlWrites = [];
    const original = globalThis.history.replaceState.bind(globalThis.history);
    globalThis.history.replaceState = (...args) => {
      globalThis.urlWrites.push(args[2]);
      return original(...args);
    };
  });
  const tension = page.getByLabel('tension', { exact: true });
  await tension.scrollIntoViewIfNeeded();
  const box = await tension.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
  await page.waitForTimeout(2000);
  expect(await page.evaluate(() => globalThis.urlWrites.length)).toBe(0);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => globalThis.urlWrites.length))
    .toBe(1);
  await page.evaluate(() =>
    globalThis.networkEditorExample.editor.updateOptions({ frame: [2, 10, -5] })
  );
  await page.getByLabel('color', { exact: true }).fill('#abcdef');
  await ready(page);
  await expect
    .poll(() =>
      page.evaluate(() =>
        new globalThis.URL(globalThis.location.href).searchParams.has('frame')
      )
    )
    .toBe(true);
  await tension.focus();
  await page.keyboard.press('ArrowRight');
  await ready(page);
  await expect
    .poll(() =>
      page.evaluate(() =>
        new globalThis.URL(globalThis.location.href).searchParams.has('frame')
      )
    )
    .toBe(false);
});

test('PNG and JPEG downloads are exactly the presentation raster and LiNo has one link per line', async ({
  page,
}, info) => {
  await open(page);
  await page.evaluate(() =>
    globalThis.networkEditorExample.editor.updateOptions({
      'background.color': '#123456',
    })
  );
  for (const [label, type, extension] of [
    ['PNG', 'image/png', 'png'],
    ['JPEG', 'image/jpeg', 'jpg'],
  ]) {
    const expected = await page.evaluate(async (type) => {
      const p = globalThis.networkEditorExample.presentation;
      return [
        ...new Uint8Array(
          await (
            await p.toRaster(type, { background: '#123456' })
          ).arrayBuffer()
        ),
      ];
    }, type);
    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('button', { name: `Download ${label}`, exact: true })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      `links-network-11-22-12.${extension}`
    );
    const destination = info.outputPath(`download.${extension}`);
    await download.saveAs(destination);
    expect([...(await readFile(destination))]).toEqual(expected);
  }
  const result = await page.evaluate(async () => {
    const blob = await globalThis.networkEditorExample.presentation.toRaster(
      'image/jpeg',
      { background: '#123456' }
    );
    const bitmap = await globalThis.createImageBitmap(blob),
      canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    return [...context.getImageData(0, 0, 1, 1).data];
  });
  expect(Math.abs(result[0] - 18)).toBeLessThan(4);
  expect(Math.abs(result[1] - 52)).toBeLessThan(4);
  expect(Math.abs(result[2] - 86)).toBeLessThan(4);
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download LINO', exact: true })
    .click();
  const download = await downloadPromise,
    destination = info.outputPath('network.lino');
  await download.saveAs(destination);
  expect((await readFile(destination, 'utf8')).trim().split('\n')).toEqual([
    '1: 1 1',
    '2: 2 2',
    '3: 1 2',
  ]);
});

test('ClipboardItem is constructed in the image click activation stack', async ({
  page,
}) => {
  await page.addInitScript(() => {
    globalThis.clipboardRecord = {};
    globalThis.ClipboardItem = class {
      constructor(data) {
        globalThis.clipboardRecord.active =
          globalThis.navigator.userActivation.isActive;
        globalThis.clipboardRecord.promise =
          data['image/png'] instanceof Promise;
      }
    };
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { write: async () => {}, writeText: async () => {} },
    });
  });
  await open(page);
  await page.getByRole('button', { name: 'Copy image', exact: true }).click();
  expect(await page.evaluate(() => globalThis.clipboardRecord)).toEqual({
    active: true,
    promise: true,
  });
  await expect(page.getByRole('status')).toHaveText('Done');
});
