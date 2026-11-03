import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('sample renders and keyboard activation updates the subscribed greeting', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('greeting')).toHaveText('Hello, links');
  await expect(page.getByRole('button', { name: 'OK' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'OK' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('greeting')).toHaveText('Hello, native links');
  await expect(page.getByText('Navigated to home')).toBeVisible();
  expect(errors).toEqual([]);
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
});

test('dark color scheme preserves accessible controls and text contrast', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('greeting')).toHaveText('Hello, links');
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
});
