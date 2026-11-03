/**
 * The ui-animation example (examples/animation/) in a real browser:
 *
 * - `panel-enter` animates translate, opacity and clip-path on the WAAPI
 *   with `(fill backwards)`; when it has finished the computed `translate`
 *   and `clip-path` equal their values before it, so nothing is left on the
 *   panel (the fill-mode regression the validator also guards);
 * - "Play intro" plays the timeline (panel, staggered springs, the seeded
 *   decipher effect) and the title ends as its own text;
 * - "Reduce motion" and the user agent preference switch to the
 *   `(reduced-motion ...)` variants;
 * - the `pressed` state in the store fires `press-feedback`;
 * - the spring easing compiles to a `linear()` the browser accepts;
 * - axe finds no WCAG 2.2 A/AA violation.
 *
 * Screenshots are attached to the report; with ANIMATION_SCREENSHOTS set to
 * a folder they are written there too.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { expect, test } from '@playwright/test';

import { expectAccessible } from '../ui/helpers.mjs';

const PAGE = 'examples/animation/';

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'the animation example is checked in Chromium'
);

async function screenshot(page, name, testInfo) {
  const body = await page.locator('main').screenshot();
  await testInfo.attach(name, { body, contentType: 'image/png' });
  const folder = process.env.ANIMATION_SCREENSHOTS;
  if (folder) {
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, `${name}.png`), body);
  }
}

/** Open the example with the given motion preference of the user agent. */
async function open(page, reducedMotion = 'no-preference') {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion });
  await page.goto(PAGE);
  await expect(page.locator('body[data-ready="true"]')).toBeAttached();
  return errors;
}

/** The computed styles of a rendered node that panel-enter animates. */
const computed = (page, id) =>
  page.evaluate((target) => {
    const node = window.animationExample.handle.nodeFor(target);
    const style = window.getComputedStyle(node);
    return {
      translate: style.translate,
      clipPath: style.clipPath,
      opacity: style.opacity,
      scale: style.scale,
    };
  }, id);

test.describe('ui-animation example', () => {
  test('panel-enter leaves no translate or clip-path behind', async ({
    page,
  }) => {
    const errors = await open(page);
    const before = await computed(page, 'sidebar');
    const midway = await page.evaluate(() => {
      const control = window.animationExample.play('panel-enter', 'sidebar');
      control.pause();
      control.seek(150);
      const node = window.animationExample.handle.nodeFor('sidebar');
      const style = window.getComputedStyle(node);
      const out = { translate: style.translate, clipPath: style.clipPath };
      control.play();
      return out;
    });
    // The animation runs: halfway the panel is still moving and clipped.
    expect(midway.translate).not.toBe(before.translate);
    expect(midway.clipPath).toContain('inset(');
    await page.evaluate(
      () => window.animationExample.play('panel-enter', 'sidebar').finished
    );
    const after = await computed(page, 'sidebar');
    expect(after.translate).toBe(before.translate);
    expect(after.clipPath).toBe(before.clipPath);
    expect(after.opacity).toBe(before.opacity);
    const left = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState !== 'finished' && a.playState !== 'idle')
        .map((a) => a.playState)
    );
    expect(left).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('plays the intro timeline and ends on the real title', async ({
    page,
  }, testInfo) => {
    const errors = await open(page);
    const before = await computed(page, 'item-3');
    await page.getByRole('button', { name: 'Play intro' }).click();
    const runs = await page.evaluate(() =>
      document.getAnimations().map((a) => ({
        delay: a.effect.getTiming().delay,
        duration: a.effect.getTiming().duration,
      }))
    );
    expect(runs).toEqual([
      { delay: 0, duration: 300 },
      { delay: 120, duration: 600 },
      { delay: 170, duration: 600 },
      { delay: 220, duration: 600 },
    ]);
    await page.evaluate(() => {
      document.getAnimations().forEach((a) => a.pause());
    });
    await page.evaluate(() => {
      document.getAnimations().forEach((a) => {
        a.currentTime = 200;
      });
    });
    await screenshot(page, 'intro-200ms', testInfo);
    await page.evaluate(() =>
      document.getAnimations().forEach((a) => a.play())
    );
    await expect(page.locator('#status')).toHaveText(
      'intro finished (full motion)'
    );
    await expect(
      page.getByText('Hello, links!', { exact: true })
    ).toBeVisible();
    expect(await computed(page, 'item-3')).toEqual(before);
    await screenshot(page, 'intro-finished', testInfo);
    expect(errors).toEqual([]);
  });

  test('the reduced-motion toggle plays the reduced variants', async ({
    page,
  }) => {
    await open(page);
    await page.getByLabel('Reduce motion').check();
    await expect(page.locator('#app')).toHaveAttribute(
      'data-motion',
      'reduced'
    );
    await page.getByRole('button', { name: 'Play intro' }).click();
    const durations = await page.evaluate(() =>
      document.getAnimations().map((a) => a.effect.getTiming().duration)
    );
    expect(durations.every((d) => d === 0)).toBe(true);
    await expect(page.locator('#status')).toHaveText(
      'intro finished (reduced motion)'
    );
    await page.getByLabel('Reduce motion').uncheck();
    expect(
      await page.evaluate(() => window.animationExample.player.motion('ok'))
    ).toBe('full');
  });

  test('the user agent preference reduces motion too', async ({ page }) => {
    await open(page, 'reduce');
    expect(
      await page.evaluate(() => window.animationExample.player.motion('ok'))
    ).toBe('reduced');
  });

  test('pressing OK fires press-feedback through the store', async ({
    page,
  }) => {
    await open(page);
    const button = page.getByRole('button', { name: 'OK' });
    await button.dispatchEvent('pointerdown');
    const frames = await page.evaluate(() =>
      document.getAnimations().map((a) => ({
        duration: a.effect.getTiming().duration,
        scale: a.effect.getKeyframes().map((k) => k.scale),
      }))
    );
    expect(frames).toEqual([{ duration: 150, scale: ['1', '0.96', '1'] }]);
    await button.dispatchEvent('pointerup');
  });

  test('spring easings compile to a linear() the browser accepts', async ({
    page,
  }) => {
    await open(page);
    const text = await page.locator('#spring').textContent();
    const css = text.slice(text.indexOf('linear('));
    expect(
      await page.evaluate(
        (value) => window.CSS.supports('animation-timing-function', value),
        css
      )
    ).toBe(true);
    await expect(page.locator('#safety')).toHaveText('no diagnostics');
  });

  test('has no WCAG 2.2 A/AA violation', async ({ page }) => {
    await open(page);
    await expectAccessible(page);
  });
});
