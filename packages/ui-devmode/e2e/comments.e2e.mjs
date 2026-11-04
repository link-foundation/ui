import { test, expect } from '@playwright/test';
import { expectAccessible } from '../../../tests/ui/helpers.mjs';

const PAGE = 'packages/ui-devmode/examples/?ui-dev';
const panel = (page) => page.locator('ui-comments');
async function open(page) {
  await page.goto(PAGE);
  await page
    .getByRole('button', { name: 'Comment on UI', exact: true })
    .click();
  await expect(panel(page)).toBeVisible();
}

test('per-object text tasks are anchored, editable, exported, validated and restored', async ({
  page,
}) => {
  await open(page);
  await page.locator('#app [data-link-id=ok] button').click();
  await expect(page.locator('#action')).toHaveText('none');
  await panel(page)
    .getByRole('checkbox', { name: 'greeting: text', exact: true })
    .focus();
  await page.keyboard.press('Space');
  await panel(page)
    .getByRole('textbox', { name: 'Instruction for selected objects' })
    .fill('Make this clearer');
  await panel(page)
    .getByRole('button', { name: 'Add tasks', exact: true })
    .click();
  await expect(panel(page).locator('[data-task]')).toHaveCount(2);
  await expect(
    panel(page).getByRole('button', {
      name: 'Comment on ok (1): Make this clearer',
      exact: true,
    })
  ).toBeVisible();
  await panel(page)
    .getByRole('textbox', { name: 'Instruction task-1', exact: true })
    .fill('Use Save changes');
  await panel(page)
    .locator('[data-task=task-1]')
    .getByRole('button', { name: 'Save task', exact: true })
    .click();
  await panel(page)
    .getByRole('button', { name: 'Export LiNo', exact: true })
    .click();
  const text = await panel(page)
    .getByRole('textbox', { name: 'Comments as LiNo', exact: true })
    .inputValue();
  const parsed = await page.evaluate(async (text) => {
    const { readComments } =
      await import('/packages/ui-devmode/src/comments/model.js');
    return readComments(text);
  }, text);
  expect(parsed.tasks.map((task) => task.target).sort()).toEqual([
    'greeting',
    'ok',
  ]);
  expect(parsed.events.map((event) => event.action)).toEqual([
    'create',
    'create',
    'update',
  ]);
  expect(parsed.revisions[0].source).toContain('label OK');
  await panel(page)
    .getByRole('textbox', { name: 'Comments as LiNo', exact: true })
    .fill('invalid');
  await panel(page)
    .getByRole('button', { name: 'Import LiNo', exact: true })
    .click();
  await expect(panel(page).locator('[data-task]')).toHaveCount(2);
  await page.reload();
  await page
    .getByRole('button', { name: 'Comment on UI', exact: true })
    .click();
  await expect(
    panel(page).getByRole('textbox', {
      name: 'Instruction task-1',
      exact: true,
    })
  ).toHaveValue('Use Save changes');
  await panel(page)
    .getByRole('button', { name: 'Close comments', exact: true })
    .click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator('ui-devmode-inspector')).toBeVisible();
});

test('freehand lasso selects objects, Escape cancels a gesture and application clicks stay suppressed', async ({
  page,
}) => {
  await open(page);
  const rect = await page.locator('#app [data-link-id=ok]').boundingBox();
  await panel(page).getByRole('button', { name: 'Lasso', exact: true }).click();
  const polygon = [
    [rect.x + 2, rect.y - 3],
    [rect.x + rect.width + 3, rect.y - 3],
    [rect.x + rect.width + 3, rect.y + rect.height + 3],
    [rect.x + 2, rect.y + rect.height + 3],
  ];
  await page.mouse.move(...polygon[0]);
  await page.mouse.down();
  for (const point of polygon.slice(1)) {
    await page.mouse.move(...point, { steps: 4 });
  }
  await page.mouse.up();
  await expect(
    panel(page).getByRole('checkbox', { name: 'ok: button', exact: true })
  ).toBeChecked();
  await expect(page.locator('#action')).toHaveText('none');
  await page.mouse.move(rect.x + 4, rect.y + 4);
  await page.mouse.down();
  await page.mouse.move(rect.x + 30, rect.y + 20);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(panel(page).locator('path')).not.toHaveAttribute('d');
  await expect(
    panel(page).getByRole('checkbox', { name: 'ok: button', exact: true })
  ).toBeChecked();
});

test('voice opt-in produces editable text and handles refusal without creating tasks', async ({
  page,
}) => {
  await page.addInitScript(() => {
    class Recognition {
      start() {
        globalThis.testRecognition = this;
      }
      abort() {
        this.aborted = true;
      }
    }
    globalThis.SpeechRecognition = Recognition;
  });
  await open(page);
  expect(await page.evaluate(() => globalThis.testRecognition)).toBeUndefined();
  await panel(page)
    .getByRole('checkbox', { name: 'ok: button', exact: true })
    .check();
  await panel(page)
    .getByRole('button', { name: 'Start voice input', exact: true })
    .click();
  await page.evaluate(() => {
    const result = [{ transcript: 'Use Save changes' }];
    result.isFinal = true;
    globalThis.testRecognition.onresult({ resultIndex: 0, results: [result] });
  });
  await expect(
    panel(page).getByRole('textbox', {
      name: 'Instruction for selected objects',
    })
  ).toHaveValue('Use Save changes');
  await expect(panel(page).locator('[data-task]')).toHaveCount(0);
  await panel(page)
    .getByRole('button', { name: 'Add tasks', exact: true })
    .click();
  await expect(panel(page).locator('[data-task] .meta')).toContainText('voice');
  await panel(page)
    .getByRole('button', { name: 'Start voice input', exact: true })
    .click();
  await page.evaluate(() =>
    globalThis.testRecognition.onerror({ error: 'not-allowed' })
  );
  await expect(panel(page).getByRole('status')).toContainText('not-allowed');
  await expect(
    panel(page).getByRole('button', { name: 'Start voice input', exact: true })
  ).toHaveAttribute('aria-pressed', 'false');
});

for (const colorScheme of ['light', 'dark']) {
  test(`comments are accessible in ${colorScheme} mode`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    await open(page);
    await panel(page)
      .getByRole('checkbox', { name: 'ok: button', exact: true })
      .check();
    await panel(page)
      .getByRole('textbox', { name: 'Instruction for selected objects' })
      .fill('Use Save changes and make the action clearer.');
    await panel(page)
      .getByRole('button', { name: 'Add tasks', exact: true })
      .click();
    await expectAccessible(page);
    await testInfo.attach(`comments-${colorScheme}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    if (
      process.env.COMMENT_SCREENSHOTS === '1' &&
      testInfo.project.name === 'chromium'
    ) {
      await page.screenshot({
        path: `docs/screenshots/ui-comments${colorScheme === 'dark' ? '-dark' : ''}.png`,
      });
    }
  });
}

test('designer opens the same comments workflow and preserves its document', async ({
  page,
}) => {
  await page.goto('packages/ui-designer/examples/index.html');
  await page
    .getByRole('button', { name: 'Comment on UI', exact: true })
    .click();
  await expect(panel(page)).toBeVisible();
  await panel(page)
    .getByRole('checkbox', { name: 'ok: button', exact: true })
    .check();
  await panel(page)
    .getByRole('textbox', { name: 'Instruction for selected objects' })
    .fill('Use a clearer label');
  await panel(page)
    .getByRole('button', { name: 'Add tasks', exact: true })
    .click();
  await expect(panel(page).locator('[data-task]')).toHaveCount(1);
  await panel(page)
    .getByRole('button', { name: 'Close comments', exact: true })
    .click();
  await expect(
    page.locator('.designer-canvas [data-link-id=ok]')
  ).toContainText('OK');
});

test('foreign pages share comments, isolated storage and agent snapshots', async ({
  page,
}) => {
  const visit = async () => {
    await page.goto('/packages/ui-devmode/tests/fixtures/foreign.html');
    await page.addScriptTag({ path: 'packages/ui-devmode/dist/devmode.js' });
    await page.evaluate(() => globalThis.linkUiForeignReady);
    await page
      .getByRole('button', { name: 'Comment on UI', exact: true })
      .click();
  };
  await visit();
  const original = await page.locator('#card-title').textContent();
  await page.locator('#card-title').click();
  await panel(page)
    .getByRole('textbox', { name: 'Instruction for selected objects' })
    .fill('Make the heading easier to scan');
  await panel(page)
    .getByRole('button', { name: 'Add tasks', exact: true })
    .click();
  await expect(panel(page).locator('[data-task]')).toHaveCount(1);
  await page.evaluate(() => globalThis.linkUiForeignDevMode.whenSaved());
  await expect(page.locator('#card-title')).toHaveText(original);
  await page.reload();
  await page.addScriptTag({ path: 'packages/ui-devmode/dist/devmode.js' });
  await page.evaluate(() => globalThis.linkUiForeignReady);
  await page
    .getByRole('button', { name: 'Comment on UI', exact: true })
    .click();
  await expect(panel(page).locator('[data-task] textarea')).toHaveValue(
    'Make the heading easier to scan'
  );
  await panel(page)
    .getByRole('button', { name: 'Export LiNo', exact: true })
    .click();
  await expect(
    panel(page).getByRole('textbox', { name: 'Comments as LiNo', exact: true })
  ).toHaveValue(/target card-title/);
  await expectAccessible(page, { include: 'ui-foreign-devmode' });
});
