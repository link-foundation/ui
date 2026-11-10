import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { listThemes, loadTheme } from '@link-foundation/ui-themes';
import { cssVariable } from '@link-foundation/ui-tokens';

const home = '/packages/site/dist/';
const ready = (page) =>
  expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
async function choose(page, label, value) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
}

for (const [label, selector] of [
  ['Theme', '#app > ui-document'],
  ['Preview theme', '#live-preview ui-document'],
]) {
  test(`every theme switches with precompiled CSS: ${label}`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${home}en/playground/`);
    await ready(page);
    const target = page.locator(selector);
    for (const id of listThemes()) {
      // Some themes are standalone chat styles with no color.primary token.
      const theme = await loadTheme(id);
      const variable = cssVariable(theme.tokens.keys().next().value);
      await page.getByRole('combobox', { name: label, exact: true }).click();
      await page.locator(`[role="option"][data-value="${id}"]:visible`).click();
      await expect(target).toHaveAttribute('data-theme', id);
      // Check a token this theme actually defines in the shared stylesheet.
      await expect
        .poll(() =>
          target.evaluate(
            (node, name) =>
              globalThis.getComputedStyle(node).getPropertyValue(name),
            variable
          )
        )
        .not.toBe('');
    }
    expect(errors).toEqual([]);
  });
}

test('every localized site page hydrates with the client theme registry', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const language of ['en', 'ru']) {
    for (const route of [
      '',
      'getting-started/',
      'dialect/',
      'components/',
      'playground/',
      'themes/',
      'about/',
    ]) {
      await page.goto(`${home}${language}/${route}`);
      await ready(page);
      await expect(page.locator('main h1')).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

for (const language of ['en', 'ru']) {
  for (const scheme of ['light', 'dark']) {
    test(`site ${language} ${scheme}: static content, theme and axe`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`${home}${language}/`);
      await ready(page);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        language === 'en'
          ? 'UI described as links'
          : 'Интерфейс, описанный связями'
      );
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations
      ).toEqual([]);
    });
  }
}

test('site content and language navigation work without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4173${home}en/`);
    await expect(
      page.getByRole('heading', { name: 'UI described as links' })
    ).toBeVisible();
    await page
      .getByRole('link', { name: 'Get started', exact: true })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Getting started', exact: true })
    ).toBeVisible();
    await page.getByRole('link', { name: 'Русский', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Начало работы', exact: true })
    ).toBeVisible();
    await page.goto(`http://127.0.0.1:4173${home}`);
    await expect(page.getByRole('link', { name: 'English' })).toBeVisible();
  } finally {
    await context.close();
  }
});

for (const [name, id] of [
  ['Material 3', 'material3'],
  ['HIG · iOS', 'hig-ios'],
  ['Fluent 2', 'fluent2'],
]) {
  test(`site theme ${name} persists across reloads`, async ({ page }) => {
    await page.goto(`${home}en/themes/`);
    await ready(page);
    await choose(page, 'Theme', name);
    await page.reload();
    await ready(page);
    await expect(page.locator('ui-document')).toHaveAttribute('data-theme', id);
  });
}

test('site scheme persists and system follows the OS', async ({ page }) => {
  await page.goto(`${home}en/themes/`);
  await ready(page);
  await choose(page, 'Colour scheme', 'Dark');
  await expect(page.locator('ui-document')).toHaveAttribute(
    'data-scheme',
    'dark'
  );
  await page.reload();
  await ready(page);
  await expect(page.locator('ui-document')).toHaveAttribute(
    'data-scheme',
    'dark'
  );
  await choose(page, 'Colour scheme', 'Light');
  await expect(page.locator('ui-document')).toHaveAttribute(
    'data-scheme',
    'light'
  );
  await choose(page, 'Theme', 'Material 3');
  await choose(page, 'Colour scheme', 'Follow system');
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await page
    .locator('ui-document')
    .evaluate((node) => globalThis.getComputedStyle(node).backgroundColor);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('ui-document')).toHaveAttribute(
    'data-scheme',
    'system'
  );
  await expect
    .poll(() =>
      page
        .locator('ui-document')
        .evaluate((node) => globalThis.getComputedStyle(node).backgroundColor)
    )
    .not.toBe(light);
});

test('site language navigation keeps the page and selected theme', async ({
  page,
}) => {
  await page.goto(`${home}en/themes/`);
  await ready(page);
  await choose(page, 'Theme', 'Material 3');
  // A URL assertion can pass at navigation commit, before the new module loads.
  await Promise.all([
    page.waitForURL(new RegExp(`${home}ru/themes/$`)),
    choose(page, 'Language', 'Русский'),
  ]);
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('ui-document')).toHaveAttribute(
    'data-theme',
    'material3'
  );
});

test('site root follows the browser language', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ru-RU' });
  try {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4173${home}`);
    await expect(page).toHaveURL(new RegExp(`${home}ru/$`));
  } finally {
    await context.close();
  }
});

test('site dev mode opens from URL and shortcut', async ({ page }) => {
  await page.goto(`${home}en/?ui-dev`);
  await ready(page);
  await expect
    .poll(() => page.evaluate(() => Boolean(globalThis.linkUiDevMode)))
    .toBe(true);
  await page.evaluate(() => globalThis.linkUiDevMode.close());
  await page.keyboard.press('Alt+Shift+KeyD');
  await expect
    .poll(() => page.evaluate(() => Boolean(globalThis.linkUiDevMode)))
    .toBe(true);
});
