/* global window, document */
/** Bounded reproduction of DOM-only selection loss before text insertion (#197).
 * Start scripts/serve-static.mjs on port 4173 before running this script.
 */
import assert from 'node:assert/strict';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from '@playwright/test';

const replacement = "theme: theme\n  token color.primary '#6750A4'";
const browser = await chromium.launch();
try {
  for (const keyboard of [false, true]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    page.setDefaultTimeout(10_000);
    try {
      await page.goto(
        'http://127.0.0.1:4173/packages/ui-components/examples/editor.html'
      );
      await page.locator('ui-code-editor[data-ready="true"]').waitFor();
      await page.getByRole('tab', { name: 'tokens.lino', exact: true }).click();
      const input = page.getByRole('textbox', {
        name: 'LiNo source',
        exact: true,
      });
      const original = await page.evaluate(
        () => window.editor.model.active.text
      );
      if (keyboard) {
        const modifier = await page.evaluate(() =>
          window.navigator.platform.startsWith('Mac') ? 'Meta' : 'Control'
        );
        await input.focus();
        await input.press(`${modifier}+a`);
      }
      const selection = await input.evaluate((element, keyboard) => {
        const selection = window.getSelection();
        if (!keyboard) {
          // Match fill's DOM-only selection, then force the real editor's
          // restoration at this boundary. This controls scheduling only.
          const range = document.createRange();
          range.selectNodeContents(element);
          selection.removeAllRanges();
          selection.addRange(range);
          element.focus();
        }
        const before = selection.toString();
        window.editor.focusEditor();
        return { before, after: selection.toString() };
      }, keyboard);
      assert.equal(selection.before, original);
      assert.equal(selection.after, keyboard ? original : '');
      await page.keyboard.insertText(replacement);
      const text = await page.evaluate(() => window.editor.model.active.text);
      assert.equal(text, keyboard ? replacement : replacement + original);
      await page.screenshot({
        path: fileURLToPath(
          new URL(keyboard ? './after.png' : './before.png', import.meta.url)
        ),
      });
      console.log({ keyboard, selection, text });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
