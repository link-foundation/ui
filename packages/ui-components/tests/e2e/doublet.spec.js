import { test, expect } from '@playwright/test';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const gallery = '/packages/ui-components/examples/doublet-network.html';
async function open(page) {
  await page.goto(gallery);
  await page.waitForFunction(() => window.doubletGallery?.ready);
}

test('doublet gallery: accessible continuous curves, nine shapes and visual regression', async ({
  page,
}) => {
  await open(page);
  const curves = page
    .locator('#overview figure')
    .first()
    .locator('[data-link]');
  await expect(curves).toHaveCount(3);
  for (const d of await curves.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('d'))
  )) {
    expect(d.match(/C /gu)).toHaveLength(2);
  }
  await expect(page.locator('#markers figure')).toHaveCount(18);
  await expectAccessible(page);
  await expect(page.locator('#overview')).toHaveScreenshot(
    'doublet-networks.png'
  );
  await expect(page.locator('#markers')).toHaveScreenshot(
    'doublet-markers.png'
  );
});

test('all caption modes fit inside the card for 1, 9 and 12 links in every font', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { createNetworkPresentation, createDoubletProvider } =
      window.doubletGallery;
    const failures = [];
    for (const count of [1, 9, 12]) {
      for (const mode of [
        'none',
        'theory',
        'pairs',
        'number',
        'links',
        'custom',
      ]) {
        for (const font of ['mono', 'sans', 'serif']) {
          const p = createNetworkPresentation(createDoubletProvider());
          await p.update({
            items: Array.from({ length: count }, (_, i) => [i + 1, i + 1]),
            index: '1234567890123456789012345678901234567890',
            options: `width 180\nheight 128\ncard\n  inset 8\n  border solid\n  width 2\ncaption\n  mode ${mode}\n  font ${font}\n  size 14\n  text 'A long custom caption that must fit within the reserved card caption space'`,
          });
          const div = document.createElement('div');
          div.innerHTML = p.toSvg();
          document.body.append(div);
          const text = div.querySelector('[data-part="caption"]');
          if (text) {
            const b = text.getBBox(),
              { width, height } = p.snapshot().frame.bounds;
            if (
              b.x < 10 - 0.1 ||
              b.x + b.width > width - 10 + 0.1 ||
              b.y < 10 ||
              b.y + b.height > height - 10 + 0.1
            ) {
              failures.push({
                count,
                mode,
                font,
                box: { x: b.x, y: b.y, width: b.width, height: b.height },
              });
            }
          }
          div.remove();
          p.dispose();
        }
      }
    }
    return failures;
  });
  expect(result).toEqual([]);
});

test('every background and card border survives real SVG and PNG/JPEG/WebP encoding', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(async () => {
    const { createNetworkPresentation, createDoubletProvider } =
      window.doubletGallery;
    async function pixels(blob) {
      const url = window.URL.createObjectURL(blob),
        image = new window.Image();
      try {
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, image.width, image.height).data;
        return [...data];
      } finally {
        window.URL.revokeObjectURL(url);
      }
    }
    const failures = [];
    for (const type of ['transparent', 'solid', 'linear', 'radial']) {
      for (const border of ['none', 'solid', 'dashed', 'dotted', 'double']) {
        const p = createNetworkPresentation(createDoubletProvider());
        await p.update({
          items: [[0, 0]],
          options: `width 96\nheight 64\nbackground\n  type ${type}\n  color '#ff0000'\n  color2 '#0000ff'\ncard\n  color '#00ff00'\n  opacity 0.6\n  border ${border}\n  borderColor '#000000'\n  width 3\n  radius 8\n  inset 10`,
        });
        const svg = p.toSvg(),
          raster = await p.toRaster();
        const a = await pixels(
            new window.Blob([svg], { type: 'image/svg+xml' })
          ),
          b = await pixels(raster);
        if (
          a.length !== b.length ||
          a.some((v, i) => {
            const alpha = i - (i % 4) + 3;
            // WebKit rounds translucent RGB twice when encoding/decoding PNG.
            // Compare painted coverage within two 8-bit levels; alpha stays exact.
            return i % 4 === 3
              ? Math.abs(v - b[i]) > 1
              : Math.abs(v * a[alpha] - b[i] * b[alpha]) / 255 > 2;
          })
        ) {
          failures.push({ type, border, reason: 'SVG/PNG pixels differ' });
        }
        if (type === 'transparent' ? b[3] !== 0 : b[3] !== 255) {
          failures.push({ type, border, reason: 'background alpha' });
        }
        // The solid card centre is green over every kind of background.
        const index = (12 * 96 + 48) * 4;
        if (b[index + 1] < 100) {
          failures.push({ type, border, reason: 'card missing' });
        }
        p.dispose();
      }
    }
    const p = window.doubletGallery.views[0];
    for (const type of ['image/jpeg', 'image/webp']) {
      const blob = await p.toRaster(type);
      if (blob.type !== type || blob.size < 100) {
        failures.push({ type, reason: 'encoder' });
      }
    }
    return failures;
  });
  expect(results).toEqual([]);
});

test('painted acute arrow tips land on the geometric endpoint for every join', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(async () => {
    const { createNetworkPresentation, createDoubletProvider } =
      window.doubletGallery;
    const results = [];
    for (const join of ['miter', 'round', 'bevel']) {
      const p = createNetworkPresentation(createDoubletProvider());
      await p.update({
        items: [[0, 0]],
        options: `width 1000\nheight 1000\nframe 20 50 50\ngaps 0 0 0 0\nlinecap butt\nstrokeWidth 2\narrowJoin ${join}\nstart\n  shape none\nmiddle\n  shape none\nend\n  shape arrow\n  angle 30\n  size 10`,
      });
      const svg = p.toSvg(),
        blob = await p.toRaster(),
        image = await window.createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      image.close();
      const bytes = ctx.getImageData(0, 0, 1000, 1000).data;
      let max = -1;
      for (let y = 350; y < 650; y++) {
        for (let x = 500; x < 850; x++) {
          if (bytes[(y * 1000 + x) * 4 + 3] > 128) {
            max = Math.max(max, x);
          }
        }
      }
      results.push({
        join,
        max,
        endpoint: p.snapshot().frame.curves[0].path[1].p3.x * 10,
        limit: Number(
          new window.DOMParser()
            .parseFromString(svg, 'image/svg+xml')
            .querySelector('[data-end="end"]')
            .getAttribute('stroke-miterlimit')
        ),
      });
      p.dispose();
    }
    return results;
  });
  for (const r of results) {
    // Pixel coverage has a one-pixel raster boundary; numerical tests use 0.01 box units.
    expect(Math.abs(r.max + 1 - r.endpoint)).toBeLessThanOrEqual(1);
    expect(r.limit).toBeGreaterThanOrEqual(2);
  }
});

test('preview markup and exported SVG are identical for every gallery scene', async ({
  page,
}) => {
  await open(page);
  const equal = await page.evaluate(() =>
    window.doubletGallery.views.map(
      (p, i) =>
        p.toSvg() === document.querySelectorAll('#overview svg')[i].outerHTML
    )
  );
  expect(equal).toEqual([true, true, true, true, true, true]);
});
