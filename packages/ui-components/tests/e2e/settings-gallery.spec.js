import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const example = '/packages/ui-components/examples/settings-gallery.html';
const row = (page, key) => page.locator(`[data-key="${key}"]`);
test.beforeEach(async ({ page }) => {
  await page.goto(example);
  await expect(page.locator('settings-panel')).toBeVisible();
});

test('balanced gallery is stable, with keyboard tabs, per-section levels and accessible previews', async ({
  page,
}) => {
  const columns = page.locator('.settings-column');
  const heights = await columns.evaluateAll((nodes) =>
    nodes.map((n) => n.getBoundingClientRect().height)
  );
  const sections = await page
    .locator('.settings-column details:visible')
    .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().height));
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(
    sections.reduce((a, b) => a + b, 0) / sections.length
  );
  await page.evaluate(() => {
    window.originalSections = [...document.querySelectorAll('details')].map(
      (node) => ({ node, parent: node.parentNode })
    );
  });
  const tabs = page.getByRole('tablist', { name: 'Appearance tabs' });
  await expect(tabs.getByRole('tab', { name: 'Empty' })).toHaveCount(0);
  await tabs.getByRole('tab', { name: 'Material', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: 'Typography' })).toBeFocused();
  await expect(row(page, 'scale')).toBeVisible();
  await row(page, 'scale').getByRole('spinbutton').fill('2');
  await expect(
    row(page, 'scale').getByRole('button', { name: 'Increase Scale' })
  ).toBeDisabled();
  await expect(
    row(page, 'scale').getByRole('button', { name: 'Increase Scale' })
  ).toHaveAttribute('tabindex', '-1');
  await row(page, 'scale').getByRole('spinbutton').press('Tab');
  await expect(
    row(page, 'scale').getByRole('button', { name: 'Increase Scale' })
  ).not.toBeFocused();
  await page.getByRole('tab', { name: 'expert', exact: true }).click();
  await expect(tabs.getByRole('tab', { name: 'Empty' })).toHaveCount(0);
  await expect(page.locator('.settings-sticky-preview')).toContainText(
    'expert'
  );
  await row(page, 'weight').getByRole('spinbutton').fill('5');
  await expect(
    page.getByRole('tab', { name: 'expert: Own values' })
  ).toHaveAttribute('data-owned');
  await row(page, 'weight')
    .getByRole('button', { name: 'Inherit Weight' })
    .click();
  await expect(row(page, 'weight').getByRole('spinbutton')).toHaveAttribute(
    'aria-valuetext',
    'inherited'
  );
  await row(page, 'details').getByRole('switch').click();
  await expect(row(page, 'radius')).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.originalSections.every(
        ({ node, parent }) => node.parentNode === parent
      )
    )
  ).toBe(true);
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
});

test('colour popover positions before focus, uses named palettes and commits only exact hex', async ({
  page,
}) => {
  const accent = row(page, 'accent');
  const trigger = accent.getByRole('button', { name: 'Accent', exact: true });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const dialog = page.getByRole('dialog', { name: 'Accent' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('slider').first()).toBeFocused();
  expect(await dialog.evaluate((node) => node.matches(':popover-open'))).toBe(
    true
  );
  await expect(
    dialog.getByRole('button', { name: 'Iris #6750a4' })
  ).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('slider').first().press('ArrowRight');
  await expect(dialog.getByRole('slider').first()).toBeFocused();
  await dialog.getByRole('button', { name: 'Plum #774477' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Plum #774477' })
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(dialog).toBeHidden();
  const input = accent.getByRole('textbox', { name: 'Accent', exact: true });
  for (const invalid of ['#abc', 'aabbcc', '#aabbcc ', 'rgb(1,2,3)']) {
    await input.fill(invalid);
    await input.press('Tab');
    expect(await page.evaluate(() => window.panel.values().accent)).toBe(
      '#774477'
    );
  }
  await input.fill('#123456');
  await input.press('Tab');
  expect(await page.evaluate(() => window.panel.values().accent)).toBe(
    '#123456'
  );
  await trigger.click();
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.getByRole('searchbox').focus();
  await expect(dialog).toBeHidden();
  await trigger.click();
  await page.locator('h1').click();
  await expect(dialog).toBeHidden();
});

test('storage events update a second bound panel and share links save the previous look across reload', async ({
  page,
  context,
}) => {
  const second = await context.newPage();
  await second.goto(example);
  await expect(second.locator('settings-panel')).toBeVisible();
  await page.evaluate(() => window.panel.update({ spacing: 20 }));
  await expect(row(second, 'spacing').getByRole('spinbutton')).toHaveValue(
    '20'
  );
  await page.evaluate(() => window.gallery.target.reset());
  await expect(row(second, 'spacing').getByRole('spinbutton')).toHaveValue('8');
  await second.close();
  await page.evaluate(() => window.panel.update({ spacing: 14 }));
  const hash = await page.evaluate(() =>
    window.gallery.toShareHash(window.gallery.schema, { spacing: 22 })
  );
  await page.goto('about:blank');
  await page.goto(`${example}${hash}`);
  await expect(row(page, 'spacing').getByRole('spinbutton')).toHaveValue('22');
  await expect(page).not.toHaveURL(/#settings/);
  await expect(page.locator('.settings-looks strong')).toContainText(
    'Before the link'
  );
  await page.reload();
  await expect(row(page, 'spacing').getByRole('spinbutton')).toHaveValue('22');
  await page
    .locator('.settings-looks')
    .getByRole('button', { name: 'Apply saved look' })
    .click();
  await expect(row(page, 'spacing').getByRole('spinbutton')).toHaveValue('14');
});

test('saved-look cards support inline rename cancellation, collision, update and copy/import', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Save look', exact: true }).click();
  const list = page.locator('.settings-looks');
  await expect(list.locator('strong')).toHaveText('Look 1');
  await list.getByRole('button', { name: 'Rename look' }).click();
  await list.getByRole('textbox').fill('Canceled');
  await list.getByRole('textbox').press('Escape');
  await expect(list.locator('strong')).toHaveText('Look 1');
  await list.getByRole('button', { name: 'Rename look' }).click();
  await list.getByRole('textbox').fill('Violet');
  await list.getByRole('textbox').press('Enter');
  await page.evaluate(() => window.panel.update({ spacing: 16 }));
  await list.getByRole('button', { name: 'Update to current' }).click();
  await page.evaluate(() =>
    Object.defineProperty(window.navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
  );
  await page.getByRole('button', { name: 'Copy all looks' }).click();
  const text = await page
    .getByRole('textbox', { name: 'Copy text', exact: true })
    .inputValue();
  await list.getByRole('button', { name: 'Delete saved look' }).click();
  await expect(page.getByText('No saved looks yet')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Your changes', exact: true })
    .fill(text);
  await page.getByRole('button', { name: 'Paste changes' }).click();
  await expect(list.locator('strong')).toHaveText('Violet');
  await page.evaluate(() => window.panel.update({ spacing: 8 }));
  await list.getByRole('button', { name: 'Apply saved look' }).click();
  await expect(row(page, 'spacing').getByRole('spinbutton')).toHaveValue('16');
  await page.getByRole('button', { name: 'Peek defaults' }).click();
  await expect(row(page, 'spacing').getByRole('spinbutton')).toHaveValue('8');
  await page.getByRole('button', { name: 'Back to my look' }).click();
  await expect(row(page, 'spacing').getByRole('spinbutton')).toHaveValue('16');
});
