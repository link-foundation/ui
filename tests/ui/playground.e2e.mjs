import { test, expect } from '@playwright/test';
import { expectAccessible } from './helpers.mjs';

const home = '/packages/site/dist/en/';
const ready = async (page, route = 'playground/') => {
  await page.goto(home + route);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
};
const preview = (page) => page.locator('#live-preview');
test('editor and preview sit side by side and the divider resizes them', async ({
  page,
}) => {
  await ready(page);
  const editor = page.locator('ui-playground-editor');
  const output = page.locator('ui-playground-preview');
  const before = await editor.boundingBox();
  const right = await output.boundingBox();
  expect(before.width).toBeGreaterThan(300);
  expect(right.x).toBeGreaterThanOrEqual(before.x + before.width);
  expect(right.y).toBe(before.y);
  const divider = page.getByRole('separator');
  await divider.focus();
  await divider.press('ArrowRight');
  await expect
    .poll(async () => (await editor.boundingBox()).width)
    .toBeGreaterThan(before.width);
});
async function choose(page, label, value) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
}

test('examples and theme/scheme choices update the source document', async ({
  page,
}) => {
  await ready(page);
  await choose(page, 'Examples', 'Checkbox · checked');
  await expect(preview(page).getByRole('checkbox')).toBeChecked();
  await choose(page, 'Preview theme', 'material3');
  await choose(page, 'Preview scheme', 'Dark');
  const editor = page.getByRole('textbox', { name: 'Links Notation' });
  await expect(editor).toHaveValue(/theme material3/);
  await expect(editor).toHaveValue(/scheme dark/);
  await expect(preview(page).locator('ui-document')).toHaveAttribute(
    'data-scheme',
    'dark'
  );
});

test('live edits update within 500ms; syntax errors keep the last preview', async ({
  page,
}) => {
  await ready(page);
  const editor = page.getByRole('textbox', { name: 'Links Notation' });
  await editor.fill("demo: document\n  hello: text 'Привет #6750A4'");
  await expect(preview(page)).toContainText('Привет #6750A4', { timeout: 500 });
  await editor.fill('demo: document\n  (hello');
  await expect(page.locator('#playground-errors')).toContainText(
    /Line 2, column \d+/
  );
  await expect(preview(page)).toContainText('Привет #6750A4');
  await editor.fill(
    "demo: document\n  a: link\n    href 'javascript:alert(1)'"
  );
  await expect(page.locator('#playground-errors')).toContainText('Unsafe URL');
  await expect(preview(page)).toContainText('Привет #6750A4');
});

test('copied links reproduce the editor and preview in another page', async ({
  page,
  context,
}) => {
  // The clipboard can be unavailable; the address bar remains a copyable fallback.
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: {
        writeText: async (text) => {
          globalThis.copiedLink = text;
        },
      },
    });
  });
  await ready(page);
  const text = "demo: document\n  hello: text 'Привет 🌍 #6750A4'";
  await page.getByRole('textbox', { name: 'Links Notation' }).fill(text);
  await expect(preview(page)).toContainText('Привет 🌍 #6750A4');
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => globalThis.copiedLink))
    .toBeTruthy();
  const url = await page.evaluate(() => globalThis.copiedLink);
  const other = await context.newPage();
  try {
    await other.goto(url);
    await expect(
      other.getByRole('textbox', { name: 'Links Notation' })
    ).toHaveValue(text);
    await expect(preview(other)).toContainText('Привет 🌍 #6750A4');
  } finally {
    await other.close();
  }
});

test('Inspect label edits update source while preserving comments', async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole('textbox', { name: 'Links Notation' })
    .fill(
      "demo: document\n  # Keep this comment\n  go: button\n    label 'Before'"
    );
  await expect(
    preview(page).getByRole('button', { name: 'Before' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => Boolean(globalThis.linkUiDevMode)))
    .toBe(true);
  await page.evaluate(() => globalThis.linkUiDevMode.select('go'));
  await page.getByRole('tab', { name: 'Properties', exact: true }).click();
  const label = page.getByRole('textbox', { name: 'label', exact: true });
  await label.fill('After');
  await label.press('Tab');
  await expect
    .poll(() =>
      page.getByRole('textbox', { name: 'Links Notation' }).inputValue()
    )
    .toContain('After');
  await expect
    .poll(() =>
      page.getByRole('textbox', { name: 'Links Notation' }).inputValue()
    )
    .toContain('# Keep this comment');
  await page.evaluate(() => globalThis.linkUiDevMode.close());
  await expect(
    preview(page).getByRole('button', { name: 'After' })
  ).toBeVisible();
});

test('gallery cell opens its theme, scheme and disabled state in the playground', async ({
  page,
}) => {
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('/gallery/')) {
      requests.push(request.url());
    }
  });
  await ready(page, 'components/');
  expect(requests).toEqual([]);
  await page.locator('[data-component="button"] summary').first().click();
  const cell = page
    .frameLocator('[data-component="button"] iframe')
    .first()
    .locator('figure')
    .nth(1);
  await expect(
    cell.getByRole('link', { name: 'Open in playground', exact: true })
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  await cell
    .getByRole('link', { name: 'Open in playground', exact: true })
    .click();
  await page.waitForURL(/\/playground\/#lino=/);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(preview(page).getByRole('button')).toBeDisabled();
  await expect(
    page.getByRole('textbox', { name: 'Links Notation' })
  ).toHaveValue(/scheme light/);
});

for (const scheme of ['light', 'dark']) {
  for (const route of ['components/', 'playground/']) {
    test(`${route} ${scheme}: accessible with review screenshot`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page, route);
      if (route === 'playground/') {
        await choose(
          page,
          'Preview scheme',
          scheme === 'dark' ? 'Dark' : 'Light'
        );
      }
      if (route === 'components/') {
        await page.locator('[data-component="button"] summary').first().click();
        await expect(
          page
            .frameLocator('[data-component="button"] iframe')
            .first()
            .getByRole('button')
            .first()
        ).toBeVisible();
      }
      await expectAccessible(page);
      await page.screenshot({
        path: `docs/screenshots/issue-63/${route.slice(0, -1)}-${scheme}.png`,
      });
    });
  }
}
