/**
 * Lottie interop in a real player: the Lottie that ui-convert exports from
 * the LiNo animation in dot-pulse.lino loads and plays in lottie-web on a
 * page whose Content-Security-Policy forbids eval.
 *
 * The comparison of the frame at 50 % with the ui-animation player (#52)
 * waits for that player.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { URL } from 'node:url';
import { expect, test } from '@playwright/test';

import { exportLottie } from '../../packages/ui-convert/src/index.js';

const PACKAGE_DIR = join(import.meta.dirname, '../../packages/ui-convert');
const require = createRequire(join(PACKAGE_DIR, 'package.json'));
const LINO = readFileSync(
  join(PACKAGE_DIR, 'tests/fixtures/interop/lottie/dot-pulse.lino'),
  'utf8'
);
const { json: ANIMATION, diagnostics } = exportLottie(LINO, 'dot-pulse');

// The page is served from a routed origin, so the policy is a real
// response header and every script is a same-origin file.
const ORIGIN = 'https://interop.test';
const POLICY =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'";
const FILES = {
  '/': [
    'text/html',
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Lottie interop</title>
    <script src="/watch.js"></script>
    <script src="/lottie.js"></script>
    <script src="/animation.js"></script>
  </head>
  <body style="margin: 0">
    <div id="stage" style="width: 512px; height: 512px"></div>
    <script src="/play.js"></script>
  </body>
</html>`,
  ],
  // Records every violation of the policy.
  '/watch.js': [
    'text/javascript',
    `window.violations = [];
document.addEventListener('securitypolicyviolation', (e) => {
  window.violations.push(e.violatedDirective + ' ' + e.blockedURI);
});`,
  ],
  // The light build has no expression engine.
  '/lottie.js': [
    'text/javascript',
    readFileSync(
      require.resolve('lottie-web/build/player/lottie_light.min.js'),
      'utf8'
    ),
  ],
  '/animation.js': [
    'text/javascript',
    `window.animation = ${JSON.stringify(ANIMATION)};`,
  ],
  '/play.js': [
    'text/javascript',
    `window.player = window.lottie.loadAnimation({
  container: document.getElementById('stage'),
  renderer: 'svg',
  loop: false,
  autoplay: false,
  animationData: window.animation,
});`,
  ],
  // Tries eval from a page script; the policy must block it.
  '/probe.js': [
    'text/javascript',
    `try {
  window.eval('1');
  window.evalBlocked = false;
} catch (error) {
  window.evalBlocked = error instanceof EvalError;
}`,
  ],
};

/** Opens the player page and waits until the animation is loaded. */
async function load(page) {
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(message.text());
    }
  });
  await page.route(`${ORIGIN}/**`, (route) => {
    const file = FILES[new URL(route.request().url()).pathname];
    return file
      ? route.fulfill({
          contentType: file[0],
          headers: { 'Content-Security-Policy': POLICY },
          body: file[1],
        })
      : route.fulfill({ status: 404 });
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => window.player?.isLoaded);
  return problems;
}

/** What lottie-web renders for the dot layer at a frame. */
const layerAt = (page, frame) =>
  page.evaluate((f) => {
    window.player.goToAndStop(f, true);
    const layer = document.querySelector('#stage svg g[clip-path] > g');
    return {
      // lottie-web hides a layer whose opacity is 0.
      visible: layer.style.display !== 'none',
      opacity: Number(layer.getAttribute('opacity')),
      transform: layer.getAttribute('transform'),
      fill: layer.querySelector('path').getAttribute('fill'),
    };
  }, frame);

test.describe('Lottie exported by ui-convert', () => {
  test('exports without errors', () => {
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  test('plays in lottie-web without eval', async ({ page }) => {
    const problems = await load(page);
    const info = await page.evaluate(() => ({
      frames: window.player.totalFrames,
      rate: window.player.frameRate,
    }));
    expect(info).toEqual({ frames: 60, rate: 60 });

    // Playing moves the animation forward in real time.
    await page.evaluate(() => window.player.play());
    await page.waitForFunction(() => window.player.currentFrame > 0);
    await page.evaluate(() => window.player.stop());
    expect(problems).toEqual([]);
    expect(await page.evaluate(() => window.violations)).toEqual([]);

    // The same policy blocks eval, so lottie-web ran without it.
    await page.addScriptTag({ url: '/probe.js' });
    expect(await page.evaluate(() => window.evalBlocked)).toBe(true);
  });

  test('renders the opacity and translate tracks', async ({ page }) => {
    const problems = await load(page);
    // opacity: 0 → 1 → 0 and translate: 0px → 100px over 60 frames.
    expect((await layerAt(page, 0)).visible).toBe(false);
    expect(await layerAt(page, 15)).toEqual({
      visible: true,
      opacity: 0.5,
      transform: 'matrix(1,0,0,1,25,0)',
      fill: 'rgb(255,85,0)',
    });
    expect(await layerAt(page, 30)).toEqual({
      visible: true,
      opacity: 1,
      transform: 'matrix(1,0,0,1,50,0)',
      fill: 'rgb(255,85,0)',
    });
    expect(problems).toEqual([]);
  });

  test('the frame at 50 % matches the ui-animation player (#52)', async ({
    page,
  }) => {
    test.skip(
      true,
      'needs the ui-animation player (#52), which is not merged yet'
    );
    await load(page);
    await layerAt(page, 30);
    await expect(page.locator('#stage')).toHaveScreenshot('dot-pulse-50.png');
  });
});
