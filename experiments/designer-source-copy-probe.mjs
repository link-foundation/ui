/** Inspect real WebKit clipboard behavior; serve the repository on port 4173. */
import assert from 'node:assert/strict';
import { devices, webkit } from '@playwright/test';

const before = process.argv.includes('--before');
const text = 'app: document\n  imported: text Imported\n';
const browser = await webkit.launch();
try {
  const page = await browser.newPage({
    ...devices['Desktop Safari'],
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  await page.goto(
    'http://127.0.0.1:4173/packages/ui-designer/examples/index.html'
  );
  await page.locator('.designer-source .cm-editor').waitFor();
  await page.evaluate(async (text) => {
    await globalThis.designer.ready;
    globalThis.designer.editSource(text);
    globalThis.navigator.clipboard.writeText = () =>
      Promise.reject(new Error('Clipboard unavailable'));
    globalThis.copyTrace = [];
    globalThis.document.addEventListener('copy', (event) => {
      globalThis.copiedSource = event.clipboardData.getData('text/plain');
      globalThis.copyTrace.push({
        type: event.type,
        text: globalThis.copiedSource,
      });
    });
    const { EditorView } = await import('@codemirror/view');
    globalThis.copyState = () => ({
      platform: globalThis.navigator.platform,
      selection: globalThis.getSelection().toString(),
      editor: EditorView.findFromDOM(
        globalThis.document.querySelector('.designer-source .cm-editor')
      ).state.selection.toJSON(),
    });
  }, text);
  const source = page.getByRole('textbox', {
    name: 'LiNo source',
    exact: true,
  });
  const editorModifier = await page.evaluate(() =>
    globalThis.navigator.platform.startsWith('Mac') ? 'Meta' : 'Control'
  );
  for (const mode of ['design', 'run']) {
    await page.evaluate((mode) => globalThis.designer.setMode(mode), mode);
    await page
      .getByRole('button', { name: 'Copy source', exact: true })
      .click();
    await source.focus();
    await page.keyboard.press(`${editorModifier}+a`);
    console.log(
      mode,
      'state',
      await page.evaluate(() => globalThis.copyState())
    );
    await page.keyboard.press('ControlOrMeta+c');
    console.log(
      mode,
      'copy events',
      await page.evaluate(() => globalThis.copyTrace)
    );
    if (mode === 'run') {
      await page.screenshot({
        path: `docs/screenshots/designer/source-copy-${before ? 'before' : 'after'}.png`,
      });
      if (!before) {
        assert.equal(await page.evaluate(() => globalThis.copiedSource), text);
      }
    }
    await page.evaluate(() => {
      globalThis.copiedSource = undefined;
      globalThis.copyTrace = [];
    });
  }
} finally {
  await browser.close();
}
