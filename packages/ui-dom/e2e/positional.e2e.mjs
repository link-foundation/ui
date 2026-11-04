import { expect, test } from '@playwright/test';
import { expectAccessible } from '../../../tests/ui/helpers.mjs';

test('positional edits preserve button properties and undo in the browser', async ({
  page,
}) => {
  await page.goto('/examples/ui-dom/');
  await expect(page.locator('#app[data-ready="true"]')).toBeAttached();
  await page.evaluate(async () => {
    const { mountDocument } = await import('@link-foundation/ui-dom');
    document.querySelector('main').innerHTML =
      '<h1>Positional updates</h1><div id="probe"></div>';
    window.positionalProbe = mountDocument(
      document.querySelector('#probe'),
      `app: document
  greeting: text 'Hello'
  ok: button 'OK'
    variant filled
    disabled true`
    );
    const { store, handle } = window.positionalProbe;
    store.setPositional('greeting', ['Hi']);
    store.setPositional('ok', ['Save']);
    handle.flush();
  });
  const greeting = page.locator('[data-link-id="greeting"]');
  const button = page.locator('[data-link-id="ok"]');
  await expect(greeting).toHaveText('Hi');
  await expect(button).toHaveText('Save');
  await expect(button).toHaveAttribute('variant', 'filled');
  await expect(button.getByRole('button')).toBeDisabled();
  await expectAccessible(page);
  await page.evaluate(() => {
    const { store, handle } = window.positionalProbe;
    store.undo();
    store.undo();
    handle.flush();
  });
  await expect(greeting).toHaveText('Hello');
  await expect(button).toHaveText('OK');
  await expect(button).toHaveAttribute('variant', 'filled');
  await expect(button.getByRole('button')).toBeDisabled();
  await page.evaluate(() => window.positionalProbe.handle.destroy());
});
