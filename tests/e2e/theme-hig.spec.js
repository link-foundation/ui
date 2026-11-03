/* global getComputedStyle */
import { mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { expectAccessible } from '../ui/helpers.mjs';

const open = async (page) => {
  await page.goto('/examples/themes/hig.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
};

test('six HIG galleries have accessible contrast, real targets and screenshot evidence', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  expect(
    await page.evaluate(() =>
      window.higGallery.diagnostics.filter((d) => d.severity === 'error')
    )
  ).toEqual([]);
  for (const variant of ['ios', 'macos']) {
    for (const mode of ['light', 'dark', 'high-contrast']) {
      const panel = page.locator(`#${variant}-${mode}`);
      const sizes = await panel
        .locator('button, input:not([type="hidden"]), [role="slider"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const box = node.getBoundingClientRect();
            return {
              tag: node.outerHTML.slice(0, 120),
              width: box.width,
              height: box.height,
            };
          })
        );
      expect(sizes.length).toBeGreaterThanOrEqual(11);
      for (const size of sizes) {
        expect(size.width, size.tag).toBeGreaterThanOrEqual(44);
        expect(size.height, size.tag).toBeGreaterThanOrEqual(44);
      }
      const body = await panel.screenshot({ animations: 'disabled' });
      await info.attach(`${variant}-${mode}`, {
        body,
        contentType: 'image/png',
      });
      if (process.env.HIG_SCREENSHOTS && info.project.name === 'chromium') {
        mkdirSync(process.env.HIG_SCREENSHOTS, { recursive: true });
        writeFileSync(
          join(process.env.HIG_SCREENSHOTS, `${variant}-${mode}.png`),
          body
        );
      }
    }
  }
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('all text styles double at 200% root size, including body and caption', async ({
  page,
}) => {
  await open(page);
  const sizes = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll('ui-text[text-style]')].map((node) =>
        Number.parseFloat(getComputedStyle(node).fontSize)
      )
    );
  // Put every declared style into both platform panels through the real store API.
  await page.evaluate(() => {
    for (const id of ['ios-light', 'macos-light']) {
      const { store, handle } = window.higGallery.mounted.get(id);
      for (const [index, name] of [
        'large-title',
        'title-1',
        'title-2',
        'title-3',
        'headline',
        'body',
        'callout',
        'subheadline',
        'footnote',
        'caption-1',
        'caption-2',
      ].entries()) {
        const child = {
          kind: 'text',
          properties: [
            { name: 'value', values: [name] },
            { name: 'text-style', values: [name] },
          ],
          children: [],
          unknown: [],
          positional: [],
        };
        store.insert(`${id}-content`, index, child);
      }
      handle.flush();
    }
  });
  const before = await sizes();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const after = await sizes();
  expect(before.length).toBeGreaterThanOrEqual(22);
  for (let i = 0; i < before.length; i++) {
    expect(after[i]).toBeCloseTo(before[i] * 2, 2);
  }
});

test('keyboard controls and the composed stepper preserve native behaviour', async ({
  page,
}) => {
  await open(page);
  const panel = page.locator('#ios-light');
  const toggle = panel.getByRole('switch');
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  const radios = panel.getByRole('radio');
  await radios.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true');
  await panel.getByRole('button', { name: 'Increase guests' }).click();
  await expect(panel.getByRole('spinbutton')).toHaveValue('3');
  await panel.getByRole('button', { name: 'Decrease guests' }).click();
  await expect(panel.getByRole('spinbutton')).toHaveValue('2');
  await panel.getByRole('spinbutton').press('ArrowUp');
  await expect(panel.getByRole('spinbutton')).toHaveValue('3');
  await panel.getByRole('combobox').press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(panel.getByRole('combobox')).toContainText('Hills');
});

test('user transparency off overrides theme; reduced motion cross-fades stationary thumbs', async ({
  page,
}) => {
  await open(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const material = page.locator('[data-link-id="ios-light-regular"]');
  await page.evaluate(() => {
    const id = 'ios-light';
    window.higGallery.configs.get(id).set('user', id, 'transparency', ['off']);
    window.higGallery.configs.get(id).set('user', id, 'motion', ['reduced']);
    window.higGallery.mounted.get(id).handle.flush();
  });
  await expect(material).toHaveCSS('backdrop-filter', 'none');
  await expect(material).toHaveCSS('background-color', 'rgb(252, 252, 254)');
  const thumb = page.locator('#ios-light ui-switch [data-part="thumb"]');
  await expect(thumb).toHaveCSS('transform', 'none');
  const track = page.locator('#ios-light ui-switch [data-part="track"]');
  const alpha = () =>
    track.evaluate((node) => [
      getComputedStyle(node, '::before').opacity,
      getComputedStyle(node, '::after').opacity,
    ]);
  await expect.poll(alpha).toEqual(['0', '1']);
  await page.locator('#ios-light').getByRole('switch').click();
  await expect.poll(alpha).toEqual(['1', '0']);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.evaluate(() => {
    const { handle } = window.higGallery.mounted.get('macos-light');
    window.higGallery.configs
      .get('macos-light')
      .set('user', 'macos-light', 'scheme', ['system']);
    handle.flush();
  });
  await expect(page.locator('#macos-light ui-document')).toHaveCSS(
    'background-color',
    'rgb(24, 26, 32)'
  );
  await expect(
    page.locator('#macos-light ui-switch [data-part="thumb"]')
  ).toHaveCSS('transform', 'none');
});

test('OS reduced transparency selects the opaque material fallback', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'CDP media emulation is Chromium-only; static fallback and user comfort run in both browsers.'
  );
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-transparency', value: 'no-preference' },
    ],
  });
  await open(page);
  const material = page.locator('[data-link-id="ios-light-regular"]');
  await expect(material).toHaveCSS('backdrop-filter', 'blur(20px)');
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });
  await expect(material).toHaveCSS('backdrop-filter', 'none');
  await expect(material).toHaveCSS('background-color', 'rgb(252, 252, 254)');
  await session.detach();
});
