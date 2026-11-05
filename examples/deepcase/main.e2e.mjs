import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startDeepcase } from './server.mjs';

test('upstream Deepcase graph and hooks read and stream from clink through ui-links', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const server = await startDeepcase();
  try {
    await page.goto(server.url);
    await expect(page.getByRole('status')).toHaveText(
      '22 links · clink GraphQL · ui-links DeepClient'
    );
    await expect
      .poll(() => page.evaluate(() => window.cyRef.current?.nodes().length))
      .toBe(22);
    await page.evaluate(async () => {
      await window.deep.insert(
        { link_id: 5, value: 'Live from clink' },
        { table: 'strings' }
      );
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.cyRef.current.getElementById('5').data('label')
        )
      )
      .toContain('Live from clink');
    await page.evaluate(async () => {
      await window.deep.delete({ link_id: 5 }, { table: 'strings' });
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.cyRef.current.getElementById('5').data('label')
        )
      )
      .not.toContain('Live from clink');
    expect(
      await page.evaluate(() =>
        window.operations.some((op) => op.query.includes('insert_strings'))
      )
    ).toBe(true);
    expect(errors).toEqual([]);
    const fit = page.getByRole('button', { name: 'Fit graph' });
    await fit.focus();
    await expect(fit).toBeFocused();
    await fit.press('Enter');
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({
      path:
        process.env.DEEPCASE_SCREENSHOT ?? 'test-results/deepcase-clink.png',
    });
  } finally {
    await page.close();
    await server.close();
  }
});
