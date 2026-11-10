import { expect, test } from '@playwright/test';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

test.describe('brand, filled and localized inline icons', () => {
  for (const theme of ['light', 'dark']) {
    test(`accessible text-colored icons in ${theme}`, async ({ page }) => {
      await page.goto('packages/ui-components/examples/inline-icons.html');
      await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
      await page.getByLabel('Theme').selectOption(theme);
      await expect(
        page.getByRole('img', { name: 'GitHub', exact: true })
      ).toHaveCount(1);
      await expect(page.locator('ui-icon[set="brand"]').nth(1)).toHaveAttribute(
        'aria-hidden',
        'true'
      );
      for (const icon of await page.locator('.marks ui-icon').all()) {
        const colors = await icon.evaluate((element) => {
          const shape = element.querySelector('path, circle');
          return [
            window.getComputedStyle(element).color,
            window.getComputedStyle(shape).fill,
          ];
        });
        expect(colors[1]).toBe(colors[0]);
      }
      for (const [locale, label, start] of [
        ['en', 'love', 'I '],
        ['ru', 'люблю', 'Я '],
      ]) {
        await page.getByLabel('Language').selectOption(locale);
        const sentence = page.locator('#sentence');
        await expect(
          sentence.getByRole('img', { name: label, exact: true })
        ).toHaveCount(1);
        await expect(sentence).toMatchAriaSnapshot(
          `- paragraph:
  - text: ${start.trim()}
  - img "${label}"
  - text: "links. {unknown}"`
        );
        await expect(sentence).toContainText('{unknown}');
        await expectAccessible(page);
      }
    });
  }
});
