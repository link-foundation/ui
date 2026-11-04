import { test, expect } from '@playwright/test';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const PAGE = 'packages/ui-components/examples/editor.html';
const input = (page) =>
  page.getByRole('textbox', { name: 'LiNo source', exact: true });
const activeText = (page) =>
  page.evaluate(() => window.editor.model.active.text);
const ready = (page) =>
  expect(page.locator('ui-code-editor')).toHaveAttribute('data-ready', 'true');

async function start(page, query = '') {
  await page.goto(PAGE + query);
  await ready(page);
  await expect
    .poll(() => page.evaluate(() => Boolean(window.editor)))
    .toBe(true);
}

for (const engine of ['codemirror', 'monaco']) {
  test(`${engine} read-only mode keeps keyboard selection and survives document changes`, async ({
    page,
  }) => {
    await start(page, engine === 'monaco' ? '?engine=monaco' : '');
    await page.evaluate(async (name) => {
      const { createEditorEngine } =
        await import('/packages/ui-components/src/editor/index.js');
      window.editor.remove();
      const host = document.createElement('div');
      host.className = 'ui-editor-area';
      document.querySelector('#editor-host').append(host);
      window.readOnlyChanges = [];
      window.readOnlyEditor = await createEditorEngine(name, host, {
        label: 'Read-only Source',
        loadMonaco: async () => window.monaco,
        onChange: (text) => window.readOnlyChanges.push(text),
      });
      window.readOnlyEditor.setReadOnly(true);
      await window.readOnlyEditor.setDocument({
        id: 'one',
        text: 'app: document',
        language: 'lino',
      });
    }, engine);
    const field = page.getByRole('textbox', {
      name: 'Read-only Source',
      exact: true,
    });
    const editorModifier = await page.evaluate(() =>
      window.navigator.platform.startsWith('Mac') ? 'Meta' : 'Control'
    );
    await field.focus();
    await expect(field).toBeFocused();
    await page.keyboard.press(`${editorModifier}+a`);
    await page.keyboard.type('Blocked');
    expect(await page.evaluate(() => window.readOnlyChanges)).toEqual([]);
    await page.evaluate(async () => {
      await window.readOnlyEditor.setDocument({
        id: 'two',
        text: 'app: document\n  title Second',
        language: 'lino',
      });
    });
    await field.focus();
    await page.keyboard.type('Still blocked');
    expect(await page.evaluate(() => window.readOnlyChanges)).toEqual([]);
    await page.evaluate(() => window.readOnlyEditor.setReadOnly(false));
    await field.focus();
    await page.keyboard.press(`${editorModifier}+a`);
    await page.keyboard.type('app: document\n  title Allowed');
    await expect
      .poll(() => page.evaluate(() => window.readOnlyChanges.at(-1)))
      .toContain('Allowed');
    expect(
      await page.evaluate(() => window.readOnlyChanges.at(-1))
    ).not.toContain('Second');
    await page.evaluate(() => window.readOnlyEditor.destroy());
  });
}

test('switching tabs preserves unsaved text and undo history; reload restores drafts', async ({
  page,
}) => {
  await start(page);
  await input(page).fill('app: document\n  title Mine');
  await expect(
    page.getByRole('tab', { name: 'document.lino •' })
  ).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'tokens.lino' }).click();
  await input(page).fill("theme: theme\n  token color.primary '#6750A4'");
  await page.getByRole('tab', { name: 'document.lino •' }).click();
  await expect(input(page)).toContainText('Mine');
  await input(page).focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => activeText(page)).not.toContain('Mine');
  await page.keyboard.press('Control+y');
  await expect.poll(() => activeText(page)).toBe('app: document\n  title Mine');
  await expect.poll(() => activeText(page)).toBe('app: document\n  title Mine');
  // Each draft has its own debounce timer; wait for both storage round trips.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { createDocumentsModel } =
          await import('/packages/ui-components/src/editor/documents-model.js');
        const restored = createDocumentsModel({
          storage: window.localStorage,
          key: 'issue-46-editor-tabs',
        });
        return [
          restored.get('document.lino').text,
          restored.get('tokens.lino').text,
        ];
      })
    )
    .toEqual([
      'app: document\n  title Mine',
      "theme: theme\n  token color.primary '#6750A4'",
    ]);
  await page.getByRole('tab', { name: 'tokens.lino •' }).click();
  await page.reload();
  await ready(page);
  await expect(
    page.getByRole('tab', { name: 'tokens.lino •' })
  ).toHaveAttribute('aria-selected', 'true');
  await expect(input(page)).toContainText('#6750A4');
  await page.getByRole('tab', { name: 'document.lino •' }).click();
  await expect(input(page)).toContainText('Mine');
});

test('dirty external updates wait for an explicit choice; compare is inert text', async ({
  page,
}) => {
  await start(page);
  await input(page).fill('app: document\n  title Mine');
  await page.getByRole('button', { name: 'Simulate external update' }).click();
  await expect(
    page.getByRole('region', { name: 'Source changed' })
  ).toBeVisible();
  await expect(input(page)).toContainText('Mine');
  await expect(
    page.getByRole('button', { name: 'Save', exact: true })
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Mine', exact: true })
  ).toContainText('Mine');
  await expect(
    page.getByRole('region', { name: 'Theirs', exact: true })
  ).toContainText('External');
  await page.getByRole('button', { name: 'Keep mine' }).click();
  await expect(input(page)).toContainText('Mine');
  await page.evaluate(() =>
    window.editor.externalUpdate(
      'document.lino',
      'app: document\n  title Newer'
    )
  );
  await page.getByRole('button', { name: 'Load theirs' }).click();
  await expect(input(page)).toContainText('Newer');
  await expect(
    page.getByRole('region', { name: 'Source changed' })
  ).toBeHidden();
});

test('empty saves and dirty-close prompts work without executing source', async ({
  page,
}) => {
  await start(page);
  await input(page).fill('window.__executed = true');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Close document' }).click();
  await expect(input(page)).toContainText('__executed');
  expect(await page.evaluate(() => window.__executed)).toBeUndefined();
  await input(page).fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('#saved')).toHaveText(
    'Saved document.lino: 0 characters'
  );
  expect(await activeText(page)).toBe('');
  await page.reload();
  await ready(page);
  expect(await activeText(page)).toBe('');
  await input(page).fill('draft');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Close document' }).click();
  await expect(page.getByRole('tab')).toHaveCount(1);
  await page.reload();
  await ready(page);
  await expect(page.getByRole('tab')).toHaveCount(1);
});

test('Escape then Tab and APG tab navigation leave focus available', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('tab', { name: 'document.lino' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'tokens.lino' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'tokens.lino' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'document.lino' })).toBeFocused();
  await input(page).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(input(page)).not.toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Simulate external update' })
  ).toBeFocused();
});

test('LiNo tokens, inline diagnostics, folding and accessible light/dark states', async ({
  page,
}) => {
  await start(page);
  await expect(page.locator('.ui-lino-id').first()).toContainText('app');
  await expectAccessible(page);
  await expect(page.locator('ui-code-editor')).toHaveScreenshot('tabs.png');
  await input(page).fill('(root\n  (child leaf))');
  await input(page).focus();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.ui-lino-match')).toHaveCount(2);
  await page
    .locator('.cm-foldGutter .cm-gutterElement')
    .filter({ hasText: '⌄' })
    .first()
    .click();
  await expect(page.locator('.cm-foldPlaceholder')).toBeVisible();
  await page.locator('.cm-foldPlaceholder').click();
  await page.getByRole('button', { name: 'Show unclosed link' }).click();
  await expect(page.getByRole('list', { name: 'Diagnostics' })).toContainText(
    '3:1 Syntax error'
  );
  await expect(page.locator('.cm-lintRange, .cm-lintPoint')).toBeAttached();
  await expect(page.locator('ui-code-editor')).toHaveScreenshot('unclosed.png');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Simulate external update' }).click();
  await expect(page.locator('ui-code-editor')).toHaveScreenshot('conflict.png');
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
});

test('CodeMirror loads lazily and Monaco is never requested by default', async ({
  page,
}) => {
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await start(page);
  expect(requests.some((url) => url.includes('@codemirror/view'))).toBe(true);
  expect(requests.filter((url) => url.includes('monaco'))).toEqual([]);
});

test('JavaScript, CSS, JSON and Markdown use lazy engine language packages', async ({
  page,
}) => {
  await start(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const [language, text] of [
    ['javascript', 'const value = 42;'],
    ['css', 'body { color: red; }'],
    ['json', '{"value":42}'],
    ['markdown', '# Title'],
  ]) {
    await page.evaluate(
      ({ language, text }) =>
        window.editor.openDocument({ id: language, language, text }),
      { language, text }
    );
    await expect(input(page)).toContainText(text);
    await expect(page.locator('ul[aria-label=Diagnostics]')).toBeEmpty();
    await expectAccessible(page);
  }
});

test('explicit Monaco selection edits text, switches tabs and escapes focus', async ({
  page,
}) => {
  await start(page, '?engine=monaco');
  await expect(page.locator('.monaco-editor')).toBeVisible();
  await page.evaluate(() => window.editor.focusEditor());
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' draft');
  await expect.poll(() => activeText(page)).toContain(' draft');
  await page.getByRole('tab', { name: 'tokens.lino' }).click();
  await page.getByRole('tab', { name: 'document.lino •' }).click();
  await expect.poll(() => activeText(page)).toContain(' draft');
  await page.getByRole('button', { name: 'Show unclosed link' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.monaco.editor
          .getModelMarkers({ owner: 'lino' })
          .map((d) => [d.startLineNumber, d.startColumn])
      )
    )
    .toEqual([[3, 1]]);
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectAccessible(page);
  await page.evaluate(() => window.editor.focusEditor());
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(page.locator('ul[aria-label=Diagnostics] button')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Simulate external update' })
  ).toBeFocused();
});

test('LiNo kind mounts through the DOM renderer and reports source updates', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    const { mountDocument } = await import('/packages/ui-dom/src/index.js');
    const host = document.createElement('div');
    host.id = 'rendered-editor';
    document.querySelector('main').append(host);
    window.editorMount = mountDocument(
      host,
      "source: code-editor\n  label 'Rendered source'\n  document-id demo\n  value 'app: document'"
    );
    await host.querySelector('ui-code-editor').ready;
  });
  const rendered = page.getByRole('textbox', {
    name: 'Rendered source',
    exact: true,
  });
  await expect(rendered).toContainText('app: document');
  await rendered.fill('draft');
  await page.evaluate(() => window.editorMount.handle.destroy());
  await expect(page.locator('#rendered-editor ui-code-editor')).toHaveCount(0);
});
