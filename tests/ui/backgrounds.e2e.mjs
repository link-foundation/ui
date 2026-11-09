import { test, expect } from '@playwright/test';
import { expectAccessible } from './helpers.mjs';

const url = '/examples/animation/backgrounds/';

test('all background layers show a still reduced-motion scene with accessible content', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await expect(page.locator('html')).toHaveAttribute(
    'data-backgrounds-ready',
    'true'
  );
  expect(errors).toEqual([]);
  await expect(page.locator('[data-ui-background]')).toHaveCount(5);
  const before = await page
    .locator('#stars')
    .evaluate((canvas) => canvas.toDataURL());
  await page.getByRole('button', { name: 'Pause animation' }).click();
  await expect(page.getByRole('button')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(
    await page.locator('#stars').evaluate((canvas) => canvas.toDataURL())
  ).toBe(before);
  await expectAccessible(page);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#stars')).toBeHidden();
});

test('no WebGL leaves the CSS fallback and other layers visible', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = window.HTMLCanvasElement.prototype.getContext;
    window.HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl' ? null : getContext.call(this, type, ...args);
    };
  });
  await page.goto(url);
  await expect(page.locator('html')).toHaveAttribute(
    'data-backgrounds-ready',
    'true'
  );
  await expect(page.locator('#nebula')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('html')).toHaveCSS(
    'background-color',
    'rgb(10, 18, 38)'
  );
  await expect(page.locator('#stars')).toBeVisible();
});

test('late CSS size, DPR changes and real rain pixel cleanup', async ({
  page,
}) => {
  await page.goto(url);
  await expect(page.locator('html')).toHaveAttribute(
    'data-backgrounds-ready',
    'true'
  );
  const result = await page.evaluate(async () => {
    const { mount } =
      await import('/packages/ui-animation/src/backgrounds/rain.js');
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    canvas.style.cssText = 'width:300px;height:150px';
    const layer = mount(canvas, { animate: false, density: 0 });
    canvas.style.cssText = 'width:800px;height:600px';
    await new Promise((resolve) =>
      new window.ResizeObserver((_, observer) => {
        observer.disconnect();
        resolve();
      }).observe(canvas)
    );
    // Wait until the layer's own observer has received the same layout notification.
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const size = [canvas.width, canvas.height];
    layer.dispose();
    canvas.remove();
    const pixel = document.createElement('canvas');
    pixel.style.cssText = 'width:2px;height:2px';
    document.body.append(pixel);
    let sequence = 0,
      paints = 0;
    const frames = new Map();
    const simulation = mount(pixel, {
      adaptive: false,
      reducedMotion: false,
      density: 1,
      columnSteps: 1,
      step: 100,
      fade: 0.075,
      environment: {
        devicePixelRatio: 1,
        requestAnimationFrame(fn) {
          frames.set(++sequence, fn);
          return sequence;
        },
        cancelAnimationFrame(id) {
          frames.delete(id);
        },
      },
      paint(ctx) {
        if (paints++ === 0) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, 2, 2);
          ctx.restore();
        }
      },
    });
    for (let frame = 0; frame <= 6000; frame++) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((fn) => fn((frame * 1000) / 60));
    }
    const residue = pixel
      .getContext('2d')
      .getImageData(0, 0, 2, 2)
      .data.some((alpha, i) => i % 4 === 3 && alpha > 0);
    simulation.dispose();
    pixel.remove();
    return { size, residue };
  });
  expect(result).toEqual({ size: [800, 600], residue: false });
});
