import { chromium, webkit } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import {
  readFrames,
  framesCss,
  frameGeometry,
  resolveFrame,
  frameLayers,
} from '../../packages/ui-themes/src/classic/frames.js';
const frames = readFrames(
  await readFile(
    new URL(
      '../../examples/themes/responsive-frames/frames.lino',
      import.meta.url
    ),
    'utf8'
  )
);
const css = framesCss(frames);
for (const [name, type] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await type.launch(
    name === 'chromium'
      ? {
          executablePath: process.env.FRAME_BROWSER ?? '/usr/bin/google-chrome',
        }
      : {}
  );
  try {
    const page = await browser.newPage();
    await page.setContent(
      `<style>${css.properties}${css.base}${Object.values(css.levels).join('')}${css.fit}body{background:#112738;color:white}article{width:80px;height:24px;--frame-material:#345266}</style><article data-frame="panel">${frameLayers()}</article>`
    );
    console.log(
      name,
      await page
        .locator('[data-frame-edge],[data-frame-corner=tl]')
        .evaluateAll((els) =>
          els.map((el) => {
            const s = globalThis.getComputedStyle(el);
            return {
              name: el.outerHTML,
              rect: el.getBoundingClientRect().toJSON(),
              width: s.width,
              height: s.height,
              stroke: s.getPropertyValue('--frame-g-top-stroke'),
              image: s.backgroundImage,
              mask: s.maskImage,
              color: s.color,
              opacity: s.opacity,
            };
          })
        )
    );
    await page.screenshot({ path: `/tmp/ui-225-logs/${name}-css.png` });
    const geometry = frameGeometry(resolveFrame(frames, 'panel'), 80, 24);
    console.log(geometry.borderSvg);
    await page.locator('article').evaluate((el, geometry) => {
      el.innerHTML = `<span style="position:absolute;inset:0;background:#345266;clip-path:${geometry.clipPath.replaceAll('"', '&quot;')}"></span>${geometry.borderSvg}`;
      el.querySelector('svg').style.cssText =
        'position:absolute;inset:0;overflow:visible';
    }, geometry);
    console.log(
      name,
      await page.locator('svg,path').evaluateAll((els) =>
        els.map((el) => ({
          node: el.outerHTML,
          rect: el.getBoundingClientRect().toJSON(),
          stroke: globalThis.getComputedStyle(el).strokeWidth,
        }))
      )
    );
    await page.screenshot({ path: `/tmp/ui-225-logs/${name}-svg.png` });
  } finally {
    await browser.close();
  }
}
