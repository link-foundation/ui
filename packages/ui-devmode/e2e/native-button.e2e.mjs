/** The example's host-page control is audited separately from the overlays. */
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { WCAG_TAGS } from '../../../tests/ui/helpers.mjs';

for (const colorScheme of ['light', 'dark']) {
  test(`native forget button meets WCAG AA in ${colorScheme} mode`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('packages/ui-devmode/examples/');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    const button = page.getByRole('button', {
      name: 'Forget saved changes',
      exact: true,
    });
    const styles = await button.evaluate((element) => {
      const style = globalThis.getComputedStyle(element);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
        appearance: style.appearance,
        colorScheme: style.colorScheme,
      };
    });
    await testInfo.attach('computed-styles', {
      body: JSON.stringify(styles, null, 2),
      contentType: 'application/json',
    });
    await testInfo.attach('native-button', {
      body: await button.screenshot(),
      contentType: 'image/png',
    });
    const results = await new AxeBuilder({ page })
      .include('#forget')
      .withTags(WCAG_TAGS)
      .analyze();
    await testInfo.attach('axe-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
    expect(results.violations).toEqual([]);
    // An inapplicable/incomplete contrast check must not count as a pass.
    expect(results.incomplete).toEqual([]);
    const contrast = results.passes.find(({ id }) => id === 'color-contrast');
    expect(contrast?.nodes.map(({ target }) => target)).toContainEqual([
      '#forget',
    ]);
    const check = contrast.nodes[0].any.find(
      ({ id }) => id === 'color-contrast'
    );
    expect(check.data.contrastRatio).toBeGreaterThanOrEqual(4.5);
    await button.focus();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('type', 'button');
  });
}
