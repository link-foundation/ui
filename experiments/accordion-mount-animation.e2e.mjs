/**
 * Does an accordion that mounts open play its opening animation? Run with:
 *   npx playwright test --config experiments/accordion-mount.config.mjs
 */
/* global getComputedStyle, matchMedia */
import { expect, test } from '@playwright/test';

test('probe', async ({ page }) => {
  await page.goto('/packages/ui-components/e2e/pages/surfaces.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const state = await page.evaluate(() => {
    const content = document.querySelector(
      '#light ui-accordion [data-part="content"][data-state="open"]'
    );
    return {
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      animationName: getComputedStyle(content).animationName,
      animations: content.getAnimations().map((a) => a.animationName),
    };
  });
  console.log(JSON.stringify(state));
});
