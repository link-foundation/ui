import { test, expect } from '@playwright/test';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';
const text = (page) => page.evaluate(() => window.designer.getText());
const key = (page, percent = 50) =>
  page.getByRole('button', {
    name: `scale key at ${percent}%, value 0.96`,
    exact: true,
  });
async function dragBy(page, node, dx) {
  await node.scrollIntoViewIfNeeded();
  const box = await node.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
}
test.beforeEach(async ({ page }) => {
  await page.goto('/packages/ui-designer/examples/timeline.html');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByRole('tab', { name: 'Timeline', exact: true }).click();
});
test('scrub uses the player under reduced motion; source-preserving key/event drags undo once', async ({
  page,
}) => {
  const ruler = page.getByRole('slider', { name: 'Playhead time' });
  const box = await ruler.boundingBox();
  await page.mouse.click(box.x + 200, box.y + 12);
  await expect(ruler).toHaveAttribute('aria-valuenow', '500');
  // The real player applies the animation-level easing globally (#186).
  await expect
    .poll(() =>
      page
        .locator('.designer-canvas [data-link-id=ok]')
        .evaluate((n) => Number(window.getComputedStyle(n).scale))
    )
    .toBeCloseTo(0.990227, 4);
  const before = await text(page);
  await dragBy(page, key(page), -40);
  expect(await text(page)).toBe(before.replace('key 0.5 0.96', 'key 0.4 0.96'));
  await page.keyboard.press('ControlOrMeta+z');
  expect(await text(page)).toBe(before);
  const event = page.getByRole('button', {
    name: 'recording-1 event at 840 ms: input pointer down ok',
  });
  await dragBy(page, event, 24);
  expect(await text(page)).toBe(before.replace('840ms', '900ms'));
  await page.keyboard.press('ControlOrMeta+z');
  expect(await text(page)).toBe(before);
});
test('keyboard keys, properties, insertion/deletion, playback, zoom and token duration', async ({
  page,
}) => {
  const before = await text(page);
  await key(page).click();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await text(page)).toBe(before);
  await key(page).click();
  await page.getByLabel('Key value', { exact: true }).fill('0.95');
  await page.getByLabel('Key value', { exact: true }).press('Tab');
  expect(await text(page)).toContain('key 0.5 0.95');
  await page.getByLabel('Key easing', { exact: true }).selectOption('ease-in');
  expect(await text(page)).toContain('key 0.5 0.95 ease-in');
  const ruler = page.getByRole('slider', { name: 'Playhead time' });
  await ruler.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('k');
  await expect(page.getByRole('button', { name: /scale key/ })).toHaveCount(4);
  await page.getByRole('button', { name: /scale key at 2%/ }).click();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('button', { name: /scale key/ })).toHaveCount(3);
  await ruler.focus();
  await page.keyboard.press('End');
  await expect(ruler).toHaveAttribute('aria-valuenow', '1000');
  await page.keyboard.press(' ');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(ruler).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: 'Loop', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Loop', exact: true })
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Duration of press-feedback' })
    .focus();
  await page.keyboard.press('ArrowRight');
  expect(await text(page)).toContain('duration 1017ms');
});
test('recording seeks an isolated canvas and properties edit actions with undo', async ({
  page,
}) => {
  const before = await text(page);
  await page.getByRole('button', { name: 'recording-1', exact: true }).click();
  const ruler = page.getByRole('slider', { name: 'Playhead time' });
  await ruler.focus();
  await page.keyboard.press('End');
  await expect(page.locator('.timeline-preview [data-link-id=ok]')).toHaveText(
    'Saved'
  );
  expect(await text(page)).toBe(before);
  expect(await page.evaluate(() => window.designer.store.log().length)).toBe(0);
  await page.keyboard.press('Home');
  await expect(page.locator('.timeline-preview [data-link-id=ok]')).toHaveText(
    'OK'
  );
  await page
    .getByRole('button', {
      name: 'recording-1 event at 840 ms: input pointer down ok',
    })
    .click();
  await page.getByLabel('Event action', { exact: true }).fill('mark Edited');
  await page.getByLabel('Event action', { exact: true }).press('Tab');
  expect(await text(page)).toContain('mark Edited');
  await ruler.focus();
  await page.keyboard.press('ControlOrMeta+z');
  expect(await text(page)).toBe(before);
});
for (const colorScheme of ['light', 'dark']) {
  test(`timeline accessibility in ${colorScheme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme });
    await key(page).click();
    await expectAccessible(page);
    await info.attach(`timeline-${colorScheme}`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  });
}

test('requested 50% midpoint equals scale 0.96', async ({ page }) => {
  test.fixme(
    true,
    'Blocked by #186: #57 expects 0.96 but the #52 player and sampler produce 0.990227 for easing standard. Do not override the fixture or player.'
  );
  const ruler = page.getByRole('slider', { name: 'Playhead time' });
  const box = await ruler.boundingBox();
  await page.mouse.click(box.x + 200, box.y + 12);
  await expect
    .poll(() =>
      page
        .locator('.designer-canvas [data-link-id=ok]')
        .evaluate((n) => Number(window.getComputedStyle(n).scale))
    )
    .toBeCloseTo(0.96, 3);
});

test('Shift selection moves as one keyboard gesture, dragging duration confirms token replacement', async ({
  page,
}) => {
  const before = await text(page);
  await key(page).click();
  await page
    .getByRole('button', { name: 'scale key at 100%, value 1' })
    .click({ modifiers: ['Shift'] });
  await expect(page.locator('.timeline-marker[aria-pressed=true]')).toHaveCount(
    2
  );
  await page.keyboard.press('Shift+ArrowLeft');
  expect(await text(page)).toContain('key 0.33333333333333337 0.96');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await text(page)).toBe(before);
  page.once('dialog', (dialog) => dialog.dismiss());
  await dragBy(
    page,
    page.getByRole('button', { name: 'Duration of press-feedback' }),
    40
  );
  expect(await text(page)).toBe(before);
  page.once('dialog', (dialog) => dialog.accept());
  await dragBy(
    page,
    page.getByRole('button', { name: 'Duration of press-feedback' }),
    40
  );
  expect(await text(page)).toContain('duration 1100ms');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await text(page)).toBe(before);
});

test('canvas selection restores its Properties after timeline selection', async ({
  page,
}) => {
  await key(page).click();
  await expect(page.getByLabel('Key value', { exact: true })).toBeVisible();
  await page.evaluate(() => window.designer.select('ok'));
  await expect(page.getByLabel('Key value', { exact: true })).toHaveCount(0);
  await expect(page.locator('.timeline-marker[aria-pressed=true]')).toHaveCount(
    0
  );
});
