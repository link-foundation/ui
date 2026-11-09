/* global window, document, URL, Image, Blob */
import { webkit } from 'playwright';
const browser = await webkit.launch({ headless: true });
const page = await browser.newPage();
await page.goto(
  'http://127.0.0.1:4173/packages/ui-components/examples/doublet-network.html'
);
await page.waitForFunction(() => window.doubletGallery?.ready);
const result = await page.evaluate(async () => {
  const { createNetworkPresentation, createDoubletProvider } =
    window.doubletGallery;
  const p = createNetworkPresentation(createDoubletProvider());
  await p.update({
    items: [[0, 0]],
    options:
      "width 96\nheight 64\ncard\n  color '#00ff00'\n  opacity 0.6\n  border none\n  radius 8\n  inset 10",
  });
  async function decode(blob) {
    const url = URL.createObjectURL(blob),
      image = new Image();
    await new Promise((resolve) => {
      image.onload = resolve;
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    return ctx.getImageData(0, 0, image.width, image.height).data;
  }
  const a = await decode(new Blob([p.toSvg()], { type: 'image/svg+xml' })),
    b = await decode(await p.toRaster());
  let maxRGB = 0,
    maxAlpha = 0;
  const examples = [];
  for (let i = 0; i < a.length; i += 4) {
    const delta = Math.max(
      ...[0, 1, 2].map(
        (k) => Math.abs(a[i + k] * a[i + 3] - b[i + k] * b[i + 3]) / 255
      )
    );
    maxRGB = Math.max(maxRGB, delta);
    maxAlpha = Math.max(maxAlpha, Math.abs(a[i + 3] - b[i + 3]));
    if (
      (delta > 1 || Math.abs(a[i + 3] - b[i + 3]) > 1) &&
      examples.length < 15
    ) {
      examples.push({
        x: (i / 4) % 96,
        y: Math.floor(i / 4 / 96),
        a: [...a.slice(i, i + 4)],
        b: [...b.slice(i, i + 4)],
        delta,
      });
    }
  }
  return { maxRGB, maxAlpha, examples };
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
