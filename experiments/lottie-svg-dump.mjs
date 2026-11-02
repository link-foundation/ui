// Prints the SVG lottie-web renders for dot-pulse at frames 0 and 30.
// Usage: node experiments/lottie-svg-dump.mjs [chromium executable]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import { chromium } from '@playwright/test';
import { exportLottie } from '../packages/ui-convert/src/index.js';

const req = createRequire(
  new URL('../packages/ui-convert/package.json', import.meta.url)
);
const lib = readFileSync(
  req.resolve('lottie-web/build/player/lottie_light.min.js'),
  'utf8'
);
const { json } = exportLottie(
  readFileSync(
    'packages/ui-convert/tests/fixtures/interop/lottie/dot-pulse.lino',
    'utf8'
  ),
  'dot-pulse'
);
const browser = await chromium.launch({ executablePath: process.argv[2] });
const page = await browser.newPage();
await page.setContent(
  '<div id="stage" style="width:512px;height:512px"></div>'
);
await page.addScriptTag({ content: lib });
for (const frame of [0, 30]) {
  const html = await page.evaluate(
    ([data, f]) => {
      const stage = globalThis.document.getElementById('stage');
      globalThis.player ??= globalThis.lottie.loadAnimation({
        container: stage,
        renderer: 'svg',
        autoplay: false,
        animationData: data,
      });
      globalThis.player.goToAndStop(f, true);
      return stage.innerHTML;
    },
    [json, frame]
  );
  console.log(frame, html);
}
await browser.close();
