/* global MutationObserver, getComputedStyle */
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { classicThemes } from '../../packages/ui-themes/src/classic/catalog.js';
import { expectAccessible } from '../ui/helpers.mjs';

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Classic theme evidence is captured in Chromium'
);
const open = async (page) => {
  await page.goto('/examples/themes/classic.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
};
async function capture(page, info, name, locator) {
  const body = await locator.screenshot({ animations: 'disabled' });
  await info.attach(name, { body, contentType: 'image/png' });
  if (process.env.CLASSIC_SCREENSHOTS) {
    mkdirSync(process.env.CLASSIC_SCREENSHOTS, { recursive: true });
    writeFileSync(join(process.env.CLASSIC_SCREENSHOTS, `${name}.png`), body);
  }
}

test('every pack renders real controls in family tabs with accessible contrast', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  for (const family of [
    'deepcase',
    'konard',
    'immortality',
    'formal-ai',
    'meta-sovereign',
  ]) {
    await page
      .getByRole('tab', {
        name: {
          deepcase: 'DeepCase',
          konard: 'Konard',
          immortality: 'Immortality',
          'formal-ai': 'Formal AI',
          'meta-sovereign': 'Meta-sovereign',
        }[family],
        exact: true,
      })
      .click();
    for (const { id } of classicThemes.filter((t) => t.family === family)) {
      const panel = page.locator(`[data-link-id="preview-${id}"]`);
      await expect(
        panel.getByRole('button', { name: 'Primary action' })
      ).toBeVisible();
      await expect(panel.locator('ui-message-bubble')).toHaveCount(2);
      if (id === 'futuristic') {
        await expect(panel).toHaveCSS('border-radius', '0px');
        await expect(
          panel.getByRole('button', { name: 'Primary action' })
        ).toHaveCSS('border-radius', '0px');
        await expect(panel.locator('ui-composer')).toHaveCSS(
          'border-radius',
          '0px'
        );
      }
      if (id === 'glass') {
        expect(
          await panel.evaluate((n) => getComputedStyle(n).backgroundColor)
        ).toContain('0.78');
      }
      await capture(page, info, id, panel);
    }
    await expectAccessible(page);
  }
  expect(await page.evaluate(() => window.classicGallery.diagnostics)).toEqual(
    []
  );
  expect(errors).toEqual([]);
});

test('historical chrome has two rows, search and attribute-only nested theme switching', async ({
  page,
}, info) => {
  await open(page);
  await expect(
    page.locator('#deepcase [data-link-id="control-row"] ui-button-group')
  ).toHaveCount(5);
  await expect(
    page.locator('#deepcase [data-link-id="switch-row"] ui-switch')
  ).toHaveCount(7);
  await expect(
    page.locator('#deepcase').getByRole('textbox', { name: 'Search links' })
  ).toBeVisible();
  await capture(
    page,
    info,
    'deepcase-classic-chrome',
    page.locator('#deepcase')
  );
  const result = await page.evaluate(() => {
    const { store, handle } = window.classicGallery.deepcase;
    const nodes = [...document.querySelectorAll('#deepcase *')];
    const observer = new MutationObserver(() => {});
    observer.observe(document.getElementById('deepcase'), {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    store.setProp('classic-chrome', 'theme', ['deepcase-dark']);
    handle.flush();
    const records = observer
      .takeRecords()
      .map((r) => ({ type: r.type, id: r.target.dataset.linkId }));
    observer.disconnect();
    return {
      same: nodes.every(
        (n, i) => n === document.querySelectorAll('#deepcase *')[i]
      ),
      records,
    };
  });
  expect(result.same).toBe(true);
  expect(result.records.length).toBeGreaterThan(0);
  expect(
    result.records.every(
      (r) => r.type === 'attributes' && r.id === 'classic-chrome'
    )
  ).toBe(true);
  await expect(
    page.locator('#deepcase [data-link-id="classic-chrome"]')
  ).toHaveCSS('--color-surface', '#141214');
  await capture(page, info, 'deepcase-dark-chrome', page.locator('#deepcase'));
  await capture(
    page,
    info,
    'historical-references',
    page.locator('.references')
  );
  for (const [theme, reference] of [
    ['deepcase-classic', 0],
    ['deepcase-dark', 1],
  ]) {
    await page.selectOption('#deepcase-theme', theme);
    await page.evaluate((index) => {
      const comparison = document.createElement('div');
      comparison.className = 'comparison';
      comparison.append(
        document.querySelectorAll('.references figure')[index].cloneNode(true)
      );
      document.querySelector('#deepcase').before(comparison);
      comparison.append(document.querySelector('#deepcase'));
    }, reference);
    await capture(
      page,
      info,
      `${theme}-comparison`,
      page.locator('.comparison')
    );
    await page.evaluate(() => {
      const comparison = document.querySelector('.comparison');
      comparison.before(document.querySelector('#deepcase'));
      comparison.remove();
    });
  }
  for (const theme of ['deepcase-perception', 'deepcase-2025']) {
    await page.selectOption('#deepcase-theme', theme);
    await expect(
      page.locator('#deepcase [data-link-id="classic-chrome"]')
    ).toHaveAttribute('data-theme', theme);
  }
});

test('nested axes are independent; reduced motion suppresses every decorative effect', async ({
  page,
}, info) => {
  await open(page);
  await page.selectOption('#skin', 'fa-material');
  await page.selectOption('#chat-style', 'chat-compact');
  await page.selectOption('#composer-style', 'composer-bubble');
  for (const [id, theme] of [
    ['axes-skin', 'fa-material'],
    ['axes-chat', 'chat-compact'],
    ['axes-composer', 'composer-bubble'],
  ]) {
    await expect(page.locator(`[data-link-id="${id}"]`)).toHaveAttribute(
      'data-theme',
      theme
    );
  }
  for (const id of ['axes-chat', 'axes-composer']) {
    await expect(page.locator(`[data-link-id="${id}"]`)).toHaveCSS(
      '--color-primary',
      '#1f7a5b'
    );
  }
  await page.selectOption('#skin', 'fa-contrast');
  await expect(page.locator('[data-link-id="axes-composer"]')).toHaveCSS(
    '--color-primary',
    '#000000'
  );
  await page.selectOption('#skin', 'fa-material');
  await capture(page, info, 'nested-axes', page.locator('#axes'));
  await page.getByRole('tab', { name: 'Immortality', exact: true }).click();
  for (const motion of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion: motion });
    for (const id of ['poseidon', 'arwes', 'quiet']) {
      const panel = page.locator(`[data-link-id="preview-${id}"]`);
      for (const effect of ['glow', 'scanline', 'flicker']) {
        const value = await panel.evaluate(
          (n, k) =>
            getComputedStyle(n).getPropertyValue(`--effect-${k}`).trim(),
          effect
        );
        if (motion === 'reduce' || id === 'quiet' || effect === 'flicker') {
          expect(value).toBe('0');
        }
      }
      expect(
        await panel.evaluate((n) => getComputedStyle(n).animationName)
      ).toBe('none');
    }
  }
  await capture(page, info, 'frames', page.locator('#frames'));
  await page.getByRole('button', { name: 'Open handler window' }).click();
  await capture(page, info, 'handler-windows', page.locator('#windows'));
  await page.getByRole('button', { name: 'Close Client handler' }).click();
});
