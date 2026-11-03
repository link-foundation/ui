/**
 * The link-view gallery in a real browser: the four cases draw the same
 * picture with the SVG and the Canvas renderer, every view zooms on its own,
 * the keyboard zooms and resets, no frame is asked for while nothing moves,
 * nothing is loaded from esm.sh or another CDN, and the page passes axe.
 * Screenshots: each case in light and dark.
 */
/* global atob, Blob, createImageBitmap, OffscreenCanvas */
import { URL } from 'node:url';

import { expect, test } from '@playwright/test';

import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const GALLERY = '/packages/ui-components/examples/link-view.html';
const CASES = ['simple', 'self-loop', 'free-end', 'blueprint'];
const NAMES = {
  simple: 'Link 1 from 1 to 2',
  'self-loop': 'Link 2 from 3 to 3, a self-loop',
  'free-end': 'Link 3 from 1 to a free end',
  blueprint: 'Link 1 from 1 to 2',
};

/** The largest share of pixels that may differ between the renderers. */
const MAX_RENDERER_DIFFERENCE = 0.02;

/** A channel difference up to this is antialiasing, not a different pixel. */
const CHANNEL_TOLERANCE = 64;

const view = (page, id) => page.locator(`#${id} link-view`);

/** Open the gallery and wait until every view has drawn. */
async function openGallery(page, query = '') {
  await page.goto(`${GALLERY}${query}`);
  await page.waitForFunction(() => {
    const views = [...document.querySelectorAll('link-view')];
    return views.length === 4 && views.every((v) => v.drawn !== null);
  });
}

/** The renderer of every view, switched with the gallery control. */
async function useRenderer(page, renderer) {
  await page.getByLabel('Renderer').selectOption(renderer);
  await page.waitForFunction(
    (r) =>
      [...document.querySelectorAll('link-view')].every(
        (v) => v.drawn?.renderer === r
      ),
    renderer
  );
}

/**
 * The share of pixels of two same-size PNG screenshots that differ by more
 * than `CHANNEL_TOLERANCE` in a channel, decoded by the browser.
 */
function pixelDifference(page, a, b) {
  return page.evaluate(
    async ([left, right, tolerance]) => {
      const pixels = async (base64) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(
          new Blob([bytes], { type: 'image/png' })
        );
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const [x, y] = await Promise.all([pixels(left), pixels(right)]);
      if (x.width !== y.width || x.height !== y.height) {
        return 1;
      }
      let different = 0;
      for (let i = 0; i < x.data.length; i += 4) {
        for (let c = 0; c < 3; c += 1) {
          if (Math.abs(x.data[i + c] - y.data[i + c]) > tolerance) {
            different += 1;
            break;
          }
        }
      }
      return different / (x.width * x.height);
    },
    [a.toString('base64'), b.toString('base64'), CHANNEL_TOLERANCE]
  );
}

test.describe('link-view gallery', () => {
  test('draws the four cases with their accessible names', async ({ page }) => {
    await openGallery(page);
    for (const id of CASES) {
      await expect(view(page, id)).toHaveAttribute('role', 'img');
      await expect(view(page, id)).toHaveAttribute('aria-label', NAMES[id]);
    }
    await expect(view(page, 'free-end')).toHaveAttribute(
      'data-markers',
      'bar cross'
    );
    const roles = await view(page, 'blueprint').evaluate((el) =>
      [...el.shadowRoot.querySelectorAll('[data-role]')].map((c) => [
        c.dataset.role,
        c.getAttribute('stroke'),
        c.getAttribute('stroke-dasharray'),
      ])
    );
    expect(roles.map(([role]) => role)).toEqual([
      'start',
      'point',
      'point',
      'point',
      'center',
      'point',
      'point',
      'point',
      'end',
    ]);
    expect(new Set(roles.map(([, , dash]) => dash))).toEqual(new Set(['4 2']));
  });

  test('loads nothing from esm.sh or any other origin', async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL).origin;
    const foreign = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('data:') && new URL(url).origin !== origin) {
        foreign.push(url);
      }
    });
    await openGallery(page);
    await useRenderer(page, 'canvas');
    await view(page, 'simple').focus();
    await page.keyboard.press('+');
    expect(foreign).toEqual([]);
    const scripts = await page.evaluate(() =>
      [...document.querySelectorAll('script[src], link[href]')].map(
        (e) => e.src || e.href
      )
    );
    expect(scripts.filter((url) => /esm\.sh|cdn|unpkg/u.test(url))).toEqual([]);
  });

  test('has no WCAG 2.2 A/AA violations', async ({ page }) => {
    await openGallery(page);
    await expectAccessible(page);
  });
});

test.describe('link-view renderers', () => {
  for (const id of CASES) {
    test(`draws the same ${id} picture with SVG and Canvas`, async ({
      page,
    }) => {
      await openGallery(page);
      const svg = await view(page, id).screenshot();
      await useRenderer(page, 'canvas');
      expect(
        await view(page, id).evaluate((el) =>
          [...el.shadowRoot.querySelector('.surface').children].map(
            (child) => child.localName
          )
        )
      ).toEqual(['canvas']);
      const canvas = await view(page, id).screenshot();
      const difference = await pixelDifference(page, svg, canvas);
      test.info().annotations.push({
        type: 'difference',
        description: `${id}: ${(difference * 100).toFixed(3)} %`,
      });
      expect(difference).toBeLessThanOrEqual(MAX_RENDERER_DIFFERENCE);
    });
  }

  test('the pixel comparison tells two different pictures apart', async ({
    page,
  }) => {
    await openGallery(page);
    const simple = await view(page, 'simple').screenshot();
    const loop = await view(page, 'self-loop').screenshot();
    expect(await pixelDifference(page, simple, simple)).toBe(0);
    expect(await pixelDifference(page, simple, loop)).toBeGreaterThan(
      MAX_RENDERER_DIFFERENCE
    );
  });
});

test.describe('link-view zoom and pan', () => {
  test('zooms with + and -, pans with arrows and resets with 0', async ({
    page,
  }) => {
    await openGallery(page);
    const simple = view(page, 'simple');
    await simple.focus();
    const k = () => simple.evaluate((el) => el.view.k);
    await page.keyboard.press('+');
    expect(await k()).toBeCloseTo(1.25, 6);
    await page.keyboard.press('-');
    await page.keyboard.press('-');
    expect(await k()).toBeCloseTo(0.8, 6);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('0');
    expect(await simple.evaluate((el) => el.view)).toEqual({
      x: 0,
      y: 0,
      k: 1,
    });
  });

  test('two views zoom and pan independently', async ({ page }) => {
    await openGallery(page);
    const first = view(page, 'simple');
    const second = view(page, 'free-end');
    const before = await second.screenshot();
    const drawnK = () => first.evaluate((el) => el.drawn.view.k);
    const fitK = await drawnK();
    const box = await first.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2);
    await page.mouse.up();
    await first.focus();
    await page.keyboard.press('+');
    expect(await drawnK()).toBeGreaterThan(1.5 * fitK);
    const views = await page.evaluate(() =>
      [...document.querySelectorAll('link-view')].map((el) => el.view)
    );
    expect(views[0].k).toBeGreaterThan(1.5);
    expect(views[0].x).not.toBe(0);
    for (const other of views.slice(1)) {
      expect(other).toEqual({ x: 0, y: 0, k: 1 });
    }
    expect(await pixelDifference(page, before, await second.screenshot())).toBe(
      0
    );
  });
});

test.describe('link-view screenshots', () => {
  test('screenshots of each case in light and dark', async ({ page }) => {
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme });
      await openGallery(page);
      for (const id of CASES) {
        await expect(page.locator(`#${id}`)).toHaveScreenshot(
          `link-view-${id}-${theme}.png`
        );
      }
    }
  });
});

test.describe('link-view frames', () => {
  // With motion allowed, a redraw waits for an animation frame.
  test.use({ reducedMotion: 'no-preference' });

  test('asks for no animation frame while idle', async ({ page }) => {
    await page.clock.install();
    await openGallery(page);
    await page.clock.runFor(100);
    await page.evaluate(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.frameRequests = 0;
      window.requestAnimationFrame = (callback) => {
        window.frameRequests += 1;
        return raf(callback);
      };
    });
    const requests = () => page.evaluate(() => window.frameRequests);
    await page.clock.runFor(1000);
    expect(await requests()).toBe(0);
    await view(page, 'simple').focus();
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await page.clock.runFor(1000);
    const afterZoom = await requests();
    expect(afterZoom).toBeGreaterThanOrEqual(1);
    expect(afterZoom).toBeLessThanOrEqual(2);
    await page.clock.runFor(1000);
    expect(await requests()).toBe(afterZoom);
    expect(
      await view(page, 'simple').evaluate((el) => el.drawn.view.k)
    ).toBeGreaterThan(
      await view(page, 'free-end').evaluate((el) => el.drawn.view.k)
    );
  });
});
