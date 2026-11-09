import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const base =
  'experiments/issue-225/test-results/packages-ui-themes-tests-e-2a875-okes-at-the-reference-sizes-chromium/reference-80-24-';
const data = await Promise.all(
  ['actual', 'expected'].map(
    async (name) =>
      `data:image/png;base64,${(await readFile(`${base}${name}.png`)).toString('base64')}`
  )
);
const browser = await chromium.launch({
  executablePath: process.env.FRAME_BROWSER,
});
try {
  const page = await browser.newPage();
  console.log(
    JSON.stringify(
      await page.evaluate(async (urls) => {
        const arrays = await Promise.all(
          urls.map(async (src) => {
            const img = new globalThis.Image();
            img.src = src;
            await img.decode();
            const canvas = globalThis.document.createElement('canvas');
            canvas.width = 80;
            canvas.height = 24;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            return Array.from(ctx.getImageData(0, 0, 80, 24).data);
          })
        );
        const pixel = (a, x, y) =>
          a.slice((y * 80 + x) * 4, (y * 80 + x) * 4 + 4);
        return {
          rows: Array.from({ length: 24 }, (_, y) => [
            y,
            Array.from({ length: 80 }, (_, x) => x).filter((x) =>
              pixel(arrays[0], x, y).some(
                (v, k) => Math.abs(v - pixel(arrays[1], x, y)[k]) > 50
              )
            ),
          ]),
          samples: [
            [30, 0],
            [30, 1],
            [79, 12],
            [30, 23],
            [0, 12],
            [17, 1],
            [22, 0],
          ].map(([x, y]) => [x, y, ...arrays.map((a) => pixel(a, x, y))]),
        };
      }, data)
    )
  );
} finally {
  await browser.close();
}
