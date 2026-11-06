/**
 * The basic controls in a real browser (Chromium and WebKit): every
 * control operated with the keyboard only, WCAG 2.2 A/AA checks in each
 * state, theme and locale, the native form submission of the values, and
 * the screenshot baselines of the theme × locale matrix.
 */
import { expect, test } from '@playwright/test';

import {
  expectAccessible,
  screenshotMatrix,
} from '../../../tests/ui/helpers.mjs';

const PAGE = 'packages/ui-components/e2e/pages/controls.html';

// The page holds every control twice (the form and the stories gallery):
// axe over it and the keyboard walks through a dozen controls take WebKit
// in the CI container more than the default 30 s.
test.describe.configure({ timeout: 60_000 });

/** The form of the page (the stories gallery below it repeats the kinds). */
const form = (page) => page.locator('#form');

/** Tab until the locator has focus. */
async function tabTo(page, locator) {
  for (let i = 0; i < 30; i += 1) {
    if (await locator.evaluate((node) => node === document.activeElement)) {
      return;
    }
    await page.keyboard.press('Tab');
  }
  await expect(locator).toBeFocused();
}

/** Every value change the page saw (`<source>.<property>=<value>`). */
const changesOf = (page) => page.evaluate(() => [...window.changes]);

/** Wait until the last value change is `text`. */
const lastChange = (page, text) =>
  expect(page.locator('#changes')).toHaveText(text);

/** The values of a property in the store of the mounted controls. */
const storeValue = (page, id, name) =>
  page.evaluate(
    ([element, property]) =>
      window.controls.store
        .get(element)
        .properties.find((p) => p.name === property)?.values,
    [id, name]
  );

/** Tab to Submit, press Enter and read the submitted form data. */
async function submitWithKeyboard(page) {
  await tabTo(page, form(page).getByRole('button', { name: 'Submit' }));
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.submitted)).toBeTruthy();
  return Object.fromEntries(await page.evaluate(() => window.submitted));
}

/** Switch the theme and the locale (remounts the controls). */
async function apply(page, { theme, locale }) {
  await page.evaluate((cell) => window.setUi(cell), { theme, locale });
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('#diagnostics')).toHaveText('none');
  await expect(form(page).locator('ui-icon-button svg')).toBeVisible();
}

/**
 * The page box measured once: down to the end of `main` and the body's
 * padding. A full-page screenshot in Chromium sometimes came out a few
 * pixels taller (empty rows below the content) than the same page a moment
 * before; a fixed clip keeps the baseline size stable.
 */
const pageClip = (page) =>
  page.evaluate(() => {
    const main = document.querySelector('main').getBoundingClientRect();
    const padding = parseFloat(
      window.getComputedStyle(document.body).paddingBottom
    );
    return {
      x: 0,
      y: 0,
      width: document.documentElement.clientWidth,
      height: Math.ceil(main.bottom + window.scrollY + padding),
    };
  });

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(PAGE);
  await expect(page.locator('#app[data-ready="true"]')).toBeAttached();
  await expect(page.locator('#diagnostics')).toHaveText('none');
  await expect(form(page).locator('ui-icon-button svg')).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('ui-components basic controls', () => {
  test('the initial states are accessible and announced', async ({ page }) => {
    await expectAccessible(page);
    await expect(
      form(page).getByRole('checkbox', { name: 'I accept' })
    ).toHaveJSProperty('indeterminate', true);
    const wifi = form(page).getByRole('switch', { name: 'Wi-Fi' });
    await expect(wifi).toHaveAttribute('aria-checked', 'true');
    const volume = form(page).getByRole('slider', { name: 'Volume' });
    await expect(volume).toHaveAttribute('aria-valuenow', '40');
    await expect(volume).toHaveAttribute('aria-valuemin', '0');
    await expect(volume).toHaveAttribute('aria-valuemax', '100');
    await expect(volume).toHaveAttribute('aria-valuetext', '40 %');
    const upload = form(page).getByRole('progressbar', { name: 'Upload' });
    await expect(upload).toHaveAttribute('aria-valuenow', '60');
    const loading = form(page).getByRole('progressbar', { name: 'Loading' });
    await expect(loading).not.toHaveAttribute('aria-valuenow', /.*/);
    const radios = form(page).getByRole('radio');
    await expect(radios).toHaveCount(3);
    await expect(
      form(page).locator('ui-radio-group [tabindex="0"]')
    ).toHaveCount(1);
  });
});

test.describe('ui-components controls with the keyboard only', () => {
  test('buttons, the link and the text inputs work with the keyboard', async ({
    page,
  }) => {
    // button and icon-button: Enter and Space press them (not submit).
    await tabTo(page, form(page).getByRole('button', { name: 'Save' }));
    await page.keyboard.press('Enter');
    await expect.poll(() => changesOf(page)).toContain('save:press');
    await page.keyboard.press('Tab');
    await expect(
      form(page).getByRole('button', { name: 'Close' })
    ).toBeFocused();
    await page.keyboard.press('Space');
    await expect.poll(() => changesOf(page)).toContain('close:press');
    expect(await page.evaluate(() => window.submitted)).toBeUndefined();
    // link: one tab stop, its target opens in a new tab.
    await page.keyboard.press('Tab');
    const docs = form(page).getByRole('link', { name: 'Documentation' });
    await expect(docs).toBeFocused();
    await expect(docs).toHaveAttribute('target', '_blank');

    // text-field: typing commits on leaving the field, Escape restores.
    const name = form(page).getByRole('textbox', { name: 'Name' });
    await tabTo(page, name);
    await page.keyboard.press('End');
    await page.keyboard.type(' L');
    await page.keyboard.press('Escape');
    await expect(name).toHaveValue('Ada');
    await page.keyboard.type('s');
    await page.keyboard.press('Tab');
    await lastChange(page, 'name.value=Adas');
    expect(await changesOf(page)).toContain('name:change');

    // text-area: Tab leaves it and commits.
    await expect(
      form(page).getByRole('textbox', { name: 'Notes' })
    ).toBeFocused();
    await page.keyboard.type('Hi');
    await page.keyboard.press('Tab');
    await lastChange(page, 'notes.value=Hi');

    // number-field: arrows step within min/max.
    const quantity = form(page).getByRole('spinbutton', { name: 'Quantity' });
    await expect(quantity).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await lastChange(page, 'quantity.value=3');
    await page.keyboard.press('End');
    await lastChange(page, 'quantity.value=3');
    await expect(quantity).toHaveAttribute('aria-valuenow', '3');
    await page.keyboard.press('PageUp');
    await lastChange(page, 'quantity.value=10');
    await expect(quantity).toHaveAttribute('aria-valuenow', '10');

    // color-field: a typed hex value is normalised.
    await tabTo(page, form(page).getByRole('textbox', { name: 'Colour' }));
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('#ABC');
    await page.keyboard.press('Enter');
    await lastChange(page, 'colour.value=#aabbcc');

    expect(await storeValue(page, 'name', 'value')).toEqual(['Adas']);
    expect(await submitWithKeyboard(page)).toMatchObject({
      name: 'Adas',
      notes: 'Hi',
      quantity: '10',
      colour: '#aabbcc',
    });
  });

  test('the checkbox, radios, switch and slider work with the keyboard', async ({
    page,
  }) => {
    // checkbox: mixed → checked → unchecked.
    const terms = form(page).getByRole('checkbox', {
      name: 'I accept the terms',
    });
    await tabTo(page, terms);
    await page.keyboard.press('Space');
    await lastChange(page, 'terms.checked=true');
    await expect(terms).toBeChecked();
    await page.keyboard.press('Space');
    await lastChange(page, 'terms.checked=false');

    // radio-group: one tab stop, arrows skip the disabled radio.
    await page.keyboard.press('Tab');
    await expect(
      form(page).getByRole('radio', { name: 'Medium' })
    ).toBeFocused();
    await page.keyboard.press('ArrowRight');
    const small = form(page).getByRole('radio', { name: 'Small' });
    await expect(small).toBeFocused();
    await expect(small).toBeChecked();
    await lastChange(page, 'size.value=small');
    await expect(
      form(page).locator('ui-radio-group [tabindex="0"]')
    ).toHaveCount(1);

    // switch: one Tab from the group; Space and Enter toggle.
    const wifi = form(page).getByRole('switch', { name: 'Wi-Fi' });
    await page.keyboard.press('Tab');
    await expect(wifi).toBeFocused();
    await page.keyboard.press('Space');
    await expect(wifi).toHaveAttribute('aria-checked', 'false');
    await lastChange(page, 'wifi.checked=false');
    await page.keyboard.press('Enter');
    await expect(wifi).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Enter');
    await expect(wifi).toHaveAttribute('aria-checked', 'false');

    // slider: arrows step, Home/End jump, the value text follows.
    const volume = form(page).getByRole('slider', { name: 'Volume' });
    await page.keyboard.press('Tab');
    await expect(volume).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await lastChange(page, 'volume.value=50');
    await expect(volume).toHaveAttribute('aria-valuetext', '50 %');
    await page.keyboard.press('Home');
    await lastChange(page, 'volume.value=0');
    await expectAccessible(page, { include: '#form' });

    expect(await storeValue(page, 'terms', 'checked')).toEqual(['false']);
    const data = await submitWithKeyboard(page);
    expect(data).toMatchObject({ size: 'small', volume: '0' });
    expect(data).not.toHaveProperty('terms');
    expect(data).not.toHaveProperty('wifi');
  });

  test('the select and the combobox work with the keyboard', async ({
    page,
  }) => {
    // select: ArrowDown opens, typeahead moves, Enter picks and closes.
    const fruit = form(page).getByRole('combobox', { name: 'Fruit' });
    await tabTo(page, fruit);
    await page.keyboard.press('ArrowDown');
    await expect(fruit).toHaveAttribute('aria-expanded', 'true');
    await expect(form(page).getByRole('listbox')).toBeVisible();
    await page.keyboard.type('p');
    await expect(fruit).toHaveAttribute('aria-activedescendant', /pear/);
    await page.keyboard.press('Enter');
    await expect(fruit).toHaveAttribute('aria-expanded', 'false');
    await expect(fruit).toHaveText('Pear');
    await lastChange(page, 'fruit.value=pear');

    // combobox: typing filters, ArrowDown and Enter pick.
    const city = form(page).getByRole('combobox', { name: 'City' });
    await page.keyboard.press('Tab');
    await expect(city).toBeFocused();
    await page.keyboard.type('Pa');
    await expect(city).toHaveAttribute('aria-expanded', 'true');
    await expect(form(page).getByRole('option')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await expect(city).toHaveAttribute('aria-activedescendant', /paris/);
    await expectAccessible(page, { include: '#form' });
    await page.keyboard.press('Enter');
    await expect(city).toHaveValue('Paris');
    await lastChange(page, 'city.value=paris');

    expect(await storeValue(page, 'fruit', 'value')).toEqual(['pear']);
    expect(await storeValue(page, 'city', 'value')).toEqual(['paris']);
    expect(await submitWithKeyboard(page)).toMatchObject({
      fruit: 'pear',
      city: 'paris',
    });
  });
});

test.describe('ui-components controls in a form and a page', () => {
  test('the initial form data are the initial values', async ({ page }) => {
    await form(page).getByRole('button', { name: 'Submit' }).click();
    await expect
      .poll(() => page.evaluate(() => window.submitted))
      .toEqual([
        ['email', 'ada@example.com'],
        ['name', 'Ada'],
        ['notes', ''],
        ['quantity', '2'],
        ['colour', '#6750a4'],
        ['size', 'medium'],
        ['wifi', 'on'],
        ['volume', '40'],
      ]);
  });

  test('a letter typed in a text field fires no shortcut', async ({ page }) => {
    const shortcuts = page.locator('#shortcuts');
    await page.locator('h1').click();
    await page.keyboard.press('s');
    await expect(shortcuts).toHaveText('1');
    await tabTo(page, form(page).getByRole('textbox', { name: 'Name' }));
    await page.keyboard.type('sss');
    await expect(shortcuts).toHaveText('1');
    await tabTo(page, form(page).getByRole('textbox', { name: 'Notes' }));
    await page.keyboard.type('s');
    await tabTo(page, form(page).getByRole('combobox', { name: 'City' }));
    await page.keyboard.type('s');
    await expect(shortcuts).toHaveText('1');
  });

  // The 'controls' screenshot matrix, one theme × locale cell per test.
  for (const locale of ['en', 'ru']) {
    for (const theme of ['light', 'dark']) {
      test(`accessible and stable: ${locale}, ${theme}`, async ({ page }) => {
        await screenshotMatrix(page, 'controls', {
          themes: [theme],
          locales: [locale],
          apply: async (p, cell) => {
            await apply(p, cell);
            await expectAccessible(p);
          },
          screenshot: async (p) => ({
            fullPage: true,
            clip: await pageClip(p),
          }),
        });
      });
    }
  }
});
