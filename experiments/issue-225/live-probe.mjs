import { chromium } from '@playwright/test';
import {
  readFrames,
  framesCss,
  frameLayers,
} from '../../packages/ui-themes/src/classic/frames.js';
const frames = readFrames(`frames
  panel
    corner top-left cut
      size 60
      width 40
      stroke 4
      color '#ff0000'
    corner top-right cut
      size 20
      stroke 4
      color '#ff0000'
  block
    extends panel
      scale 0.6
`);
const css = framesCss(frames);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.FRAME_BROWSER ?? '/usr/bin/google-chrome',
});
try {
  const page = await browser.newPage();
  await page.setContent(
    `<style>${css.properties}${css.base}${Object.values(css.levels).join('')}${css.fit} body{background:#153047} [data-frame]{width:320px;height:200px;--frame-material:#426077}</style><div data-frame="panel">${frameLayers()}<p>Frame</p></div><div data-frame="block">${frameLayers()}<p>Block</p></div>`
  );
  await page.locator('html').evaluate((el) => {
    el.style.setProperty('--frame-panel-tl-width', '100px');
    el.setAttribute('data-frame-panel-top-left-shape', 'scoop');
  });
  console.log(
    await page
      .locator(
        '[data-frame-material], [data-frame-corner="tl"], [data-frame-edge="top"]'
      )
      .evaluateAll((els) =>
        els.map((el) => {
          const s = globalThis.getComputedStyle(el);
          return {
            node: el.outerHTML,
            clip: s.clipPath,
            background: s.background,
            fit: s.getPropertyValue('--frame-g-fit'),
            w: s.getPropertyValue('--frame-g-tl-w'),
            opacity: s.opacity,
          };
        })
      )
  );
  await page.screenshot({ path: '/tmp/ui-225-logs/probe.png' });
} finally {
  await browser.close();
}
