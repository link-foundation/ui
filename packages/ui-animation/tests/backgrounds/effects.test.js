import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mount as stars } from '../../src/backgrounds/starfield.js';
import { mount as beams } from '../../src/backgrounds/beams.js';
import { mount as rain, createCadence } from '../../src/backgrounds/rain.js';
import { mount as grid } from '../../src/backgrounds/grid.js';
import { cleanupPixels } from '../../src/backgrounds/rain-cleanup.js';
import { environment } from './helpers.js';

const positions = (calls) =>
  calls.filter(([name]) => name === 'translate').map((c) => c.slice(1));

test('star colour rebuilds sprites while preserving positions and cached images', () => {
  const e = environment({ width: 1920, height: 1080 });
  const layer = stars(e.canvas, { count: 3, animate: false });
  const before = positions(e.calls).slice(-3);
  const spriteCount = e.calls.filter(([name]) => name === 'fill').length;
  e.calls.length = 0;
  layer.update({ brightness: 0.5 });
  assert.deepEqual(positions(e.calls), before);
  assert.equal(e.calls.filter(([name]) => name === 'fill').length, 0);
  e.calls.length = 0;
  layer.update({ color: '#ffcc22' });
  assert.deepEqual(positions(e.calls).slice(-3), before);
  assert.equal(e.calls.filter(([name]) => name === 'fill').length, spriteCount);
  e.calls.length = 0;
  layer.update({ count: 4 });
  assert.deepEqual(positions(e.calls).slice(0, 3), before);
  layer.dispose();
});

test('all star shapes and motion modes draw, count is area-scaled and capped', () => {
  const e = environment({ width: 3840, height: 2160 });
  const layer = stars(e.canvas, { count: 3000 });
  assert.equal(e.calls.filter(([name]) => name === 'drawImage').length, 6000);
  for (const shape of [
    'dot',
    'soft-dot',
    'ring',
    'square',
    'diamond',
    'cross',
    'cross-x',
    'star-4',
    'star-5',
    'star-6',
    'sparkle',
    'telescope-flare',
  ]) {
    layer.update({ count: 1, shape });
  }
  for (const motion of ['still', 'drift', 'warp', 'orbit']) {
    layer.update({ motion, spin: 12, streak: 2 });
    e.tick(0);
    e.tick(100);
  }
  layer.dispose();
});

test('beam direction reseeds orientation; colour preserves the current path', () => {
  const e = environment({ width: 800, height: 600 });
  const layer = beams(e.canvas, {
    count: 3,
    direction: 'horizontal',
    animate: false,
  });
  const before = positions(e.calls);
  e.calls.length = 0;
  layer.update({ color: '#ff2222' });
  assert.deepEqual(positions(e.calls), before);
  e.calls.length = 0;
  layer.update({ direction: 'vertical' });
  assert.equal(e.calls.filter(([name]) => name === 'rotate').length, 3);
  assert.notDeepEqual(positions(e.calls), before);
  for (const style of ['comet', 'segment', 'pulse', 'scan']) {
    layer.update({ style });
  }
  layer.dispose();
});

test('vertical travelling scan spans a wide viewport', () => {
  const e = environment({ width: 3000, height: 500 });
  const layer = beams(e.canvas, {
    count: 1,
    direction: 'vertical',
    style: 'scan',
    animate: false,
  });
  assert.deepEqual(
    e.calls.find(([name]) => name === 'fillRect').slice(2),
    [-3000, 1, 6000]
  );
  layer.dispose();
});

for (const [hz, count] of [
  [60, 6],
  [120, 13],
]) {
  test(`105 ms rain steps occur exactly every ${count} frames at ${hz} Hz`, () => {
    const cadence = createCadence();
    for (let i = 0; i < 30; i++) {
      cadence.frame(1000 / hz);
    }
    const hits = [];
    for (let i = 1; i <= count * 10; i++) {
      cadence.frame(1000 / hz);
      if (cadence.ready(105, 60)) {
        hits.push(i);
      }
    }
    assert.deepEqual(
      hits,
      Array.from({ length: 10 }, (_, i) => (i + 1) * count)
    );
    cadence.frame(5000);
    cadence.reset();
    assert.equal(cadence.ready(105, 60), false);
  });
}

test('1000 quantized fade steps clear old 8-bit alpha residue', () => {
  const image = { data: new Uint8ClampedArray([120, 200, 150, 255]) };
  let cleanupCount = 0;
  const ctx = {
    getImageData: () => image,
    putImageData: () => {
      cleanupCount++;
    },
  };
  for (let step = 1; step <= 1000; step++) {
    image.data[3] = Math.round(image.data[3] * (1 - 0.075));
    if (step % 10 === 0) {
      cleanupPixels(ctx, 1, 1);
    }
    if (step >= 50) {
      assert.equal(image.data[3], 0);
    }
  }
  assert.equal(cleanupCount, 100);
});

test('reduced rain is a static field with alpha 0.2..0.8; hidden glyphs keep drift only', () => {
  const e = environment();
  const alphas = [];
  const layer = rain(e.canvas, {
    reducedMotion: true,
    density: 1,
    paint(ctx) {
      alphas.push(ctx.globalAlpha);
    },
  });
  assert.ok(alphas.length > 0);
  assert.ok(alphas.every((a) => a >= 0.2 && a <= 0.8));
  assert.equal(e.frames.size, 0);
  alphas.length = 0;
  layer.update({ visible: false, drift: 12 });
  assert.equal(alphas.length, 0);
  layer.dispose();
});

test('grid wrap shifts exactly one cell', () => {
  const e = environment({ width: 800, height: 600 });
  const rainEnvironment = environment({ width: 800, height: 600 });
  const beamEnvironment = environment({ width: 800, height: 600 });
  const glyphs = [];
  const rainLayer = rain(rainEnvironment.canvas, {
    animate: false,
    density: 1,
    padding: 0,
    paint(_ctx, _glyph, x, y) {
      glyphs.push([x, y]);
    },
  });
  const beamLayer = beams(beamEnvironment.canvas, {
    animate: false,
    direction: 'horizontal',
  });
  const offsets = [];
  const layer = grid(e.canvas, {
    cellSize: 64,
    period: 1,
    onDrift(px) {
      offsets.push(px);
      glyphs.length = 0;
      beamEnvironment.calls.length = 0;
      rainLayer.update({ drift: px });
      beamLayer.update({ drift: px });
      for (const [x, y] of glyphs) {
        assert.ok(Math.abs(x % 32) < 1e-8);
        assert.ok(Math.abs((y - px) / 32 - Math.round((y - px) / 32)) < 1e-8);
      }
      for (const [, y] of positions(beamEnvironment.calls)) {
        assert.ok(Math.abs((y - px) / 64 - Math.round((y - px) / 64)) < 1e-8);
      }
    },
  });
  e.tick(0);
  for (let i = 1; i <= 65; i++) {
    e.tick((i * 1000) / 60);
  }
  const wrap = offsets.findIndex((x, i) => i > 1 && x < offsets[i - 1]);
  assert.ok(wrap > 0);
  assert.ok(
    Math.abs(offsets[wrap] - (offsets[wrap - 1] + 64 / 60 - 64)) < 1e-8
  );
  assert.ok(rainEnvironment.calls.some(([name]) => name === 'drawImage'));
  for (const pattern of ['lines', 'dashed', 'crosses', 'dots']) {
    layer.update({ pattern, radialFade: true });
  }
  layer.dispose();
  rainLayer.dispose();
  beamLayer.dispose();
});

test('missing 2D or Path2D returns a safe inert handle', () => {
  for (const mount of [stars, beams, rain]) {
    const e = environment();
    e.canvas.getContext = () => null;
    const layer = mount(e.canvas);
    layer.update({ color: 'red' });
    layer.animate(true);
    layer.dispose();
    assert.equal(e.frames.size, 0);
    assert.equal(e.canvas.style.visibility, 'hidden');
  }
  const e = environment();
  e.win.Path2D = undefined;
  const layer = stars(e.canvas);
  assert.equal(e.frames.size, 0);
  layer.dispose();
});

test('each public effect bundles independently without importing other effects', async () => {
  for (const name of [
    'starfield',
    'beams',
    'rain',
    'grid',
    'shader',
    'nebula',
  ]) {
    const result = await build({
      stdin: {
        contents: `import * as effect from '@link-foundation/ui-animation/backgrounds/${name}'; console.log(effect);`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      metafile: true,
      platform: 'browser',
    });
    const inputs = Object.keys(result.metafile.inputs);
    for (const other of [
      'starfield',
      'beams',
      'rain',
      'grid',
      'shader',
      'nebula',
    ].filter((n) => n !== name)) {
      assert.ok(
        !inputs.some((path) => path.endsWith(`/backgrounds/${other}.js`)),
        `${name} includes ${other}`
      );
    }
  }
});
