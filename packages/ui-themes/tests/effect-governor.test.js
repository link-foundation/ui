import { it } from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { createEffectGovernor } from '../src/classic/materials.js';

function clock(options = {}) {
  const queue = new Map();
  let serial = 0;
  let time = 0;
  const governor = createEffectGovernor({
    ...options,
    requestFrame: (fn) => {
      queue.set(++serial, fn);
      return serial;
    },
    cancelFrame: (id) => queue.delete(id),
  });
  return {
    governor,
    queue,
    step(gap = 1000 / 60, count = 1) {
      for (let i = 0; i < count; i++) {
        time += gap;
        const callbacks = [...queue.values()];
        queue.clear();
        for (const fn of callbacks) {
          fn(time);
        }
      }
    },
  };
}

function running(options = {}) {
  const c = clock();
  c.governor.add('layer', () => true, options);
  c.governor.set({ motion: true });
  c.step(0);
  return c;
}

it('keeps fast windows and the slow startup window at full quality', () => {
  const c = running();
  c.step(16.7, 600);
  assert.deepEqual(c.governor.getQuality('layer'), { scale: 1, fps: 1 });
  const slow = running();
  slow.step(200, 5);
  assert.deepEqual(slow.governor.getQuality('layer'), { scale: 1, fps: 1 });
});

it('lowers resolution before fps, signals each step once, and never recovers', () => {
  const changes = [];
  const c = running({ onQualityChange: (shares) => changes.push(shares) });
  c.step(16.7, 30);
  c.step(60, 20);
  assert.deepEqual(c.governor.getQuality('layer'), { scale: 0.7, fps: 1 });
  c.step(60, 100);
  assert.deepEqual(changes, [
    { scale: 0.7, fps: 1 },
    { scale: 0.49, fps: 1 },
    { scale: 0.4, fps: 1 },
    { scale: 0.4, fps: 0.5 },
    { scale: 0.4, fps: 0.25 },
  ]);
  c.step(16.7, 600);
  assert.deepEqual(c.governor.getQuality('layer'), { scale: 0.4, fps: 0.25 });
  changes[0].scale = 0;
  assert.equal(c.governor.getQuality('layer').scale, 0.4);
});

it('ignores invalid gaps and judges only a strict slow majority', () => {
  const c = running();
  for (let window = 0; window < 20; window++) {
    c.step(5000);
    c.step(0);
    c.step(16.7, 27);
    c.step(60, 3);
  }
  assert.deepEqual(c.governor.getQuality('layer'), { scale: 1, fps: 1 });
  const half = running();
  half.step(10, 30);
  half.step(46, 15);
  half.step(10, 15);
  assert.deepEqual(half.governor.getQuality('layer'), { scale: 1, fps: 1 });
});

it('supports crisp layers and configurable floors and factors independently', () => {
  const c = running({ resolution: false });
  c.governor.add('custom', () => true, {
    minScale: 0.6,
    scaleFactor: 0.8,
    minFps: 0.3,
    fpsFactor: 0.6,
  });
  c.step(60, 300);
  assert.deepEqual(c.governor.getQuality('layer'), { scale: 1, fps: 0.25 });
  assert.deepEqual(c.governor.getQuality('custom'), { scale: 0.6, fps: 0.3 });
});

it('caps draws while watching skipped frames and passes clamped elapsed seconds', () => {
  const c = clock();
  const draws = [];
  c.governor.add(
    'layer',
    (...args) => {
      draws.push(args);
      return true;
    },
    {
      fps: 30,
      resolution: false,
    }
  );
  c.governor.set({ motion: true });
  c.step(0);
  c.step(1000 / 60, 60);
  assert.equal(draws.length, 31);
  assert.equal(draws[0][2], 0);
  assert.ok(Math.abs(draws[1][2] - 1 / 30) < 1e-9);
  c.step(60, 17);
  assert.equal(c.governor.getQuality('layer').fps, 0.5);
  const before = draws.length;
  c.step(1000 / 60, 60);
  assert.equal(draws.length - before, 15);
  c.step(900);
  assert.equal(draws.at(-1)[2], 0.25);
});

for (const pause of [
  { motion: false },
  { reducedMotion: true },
  { visible: false },
]) {
  it(`resets timestamps across pause ${JSON.stringify(pause)}`, () => {
    const c = clock();
    const elapsed = [];
    c.governor.add('layer', (_time, _state, dt) => {
      elapsed.push(dt);
      return true;
    });
    c.governor.set({ motion: true });
    c.step(16.7, 31);
    c.governor.set(pause);
    assert.equal(c.queue.size, 0);
    c.step(10000);
    c.governor.set({ motion: true, reducedMotion: false, visible: true });
    c.step(16.7);
    assert.equal(elapsed.at(-1), 0);
    assert.deepEqual(c.governor.getQuality('layer'), { scale: 1, fps: 1 });
  });
}

it('coalesces still repaints without resuming motion or discarding the effect', () => {
  const c = clock();
  const draws = [];
  c.governor.add('layer', (...args) => draws.push(args));
  c.governor.invalidate('layer');
  c.governor.invalidate('layer');
  c.step();
  assert.equal(draws.length, 1);
  assert.equal(draws[0][2], 0);
  assert.equal(c.queue.size, 0);
  c.step();
  assert.equal(draws.length, 1);
  c.governor.invalidate('missing');
  assert.equal(c.queue.size, 0);
  c.governor.set({ motion: true });
  c.step();
  assert.equal(draws.length, 2);
  assert.equal(c.governor.getQuality('layer'), undefined);
});

it('automatically watches injectable visibility and reduced motion and cleans up', () => {
  const document = new globalThis.EventTarget();
  document.hidden = true;
  const media = new globalThis.EventTarget();
  media.matches = true;
  let query;
  const c = clock({
    watchVisibility: true,
    watchReducedMotion: true,
    document,
    matchMedia: (value) => {
      query = value;
      return media;
    },
  });
  c.governor.add('layer', () => true);
  c.governor.set({ motion: 'auto' });
  assert.equal(query, '(prefers-reduced-motion: reduce)');
  assert.equal(c.queue.size, 0);
  document.hidden = false;
  document.dispatchEvent(new globalThis.Event('visibilitychange'));
  assert.equal(c.queue.size, 0);
  c.governor.set({ motion: 'on' });
  assert.equal(c.queue.size, 1);
  document.hidden = true;
  document.dispatchEvent(new globalThis.Event('visibilitychange'));
  assert.equal(c.queue.size, 0);
  document.hidden = false;
  document.dispatchEvent(new globalThis.Event('visibilitychange'));
  assert.equal(c.queue.size, 1);
  c.governor.set({ motion: 'off' });
  media.matches = false;
  media.dispatchEvent(new globalThis.Event('change'));
  assert.equal(c.queue.size, 0);
  c.governor.set({ motion: 'auto' });
  assert.equal(c.queue.size, 1);
  c.governor.dispose();
  assert.equal(c.queue.size, 0);
  assert.equal(getEventListeners(document, 'visibilitychange').length, 0);
  assert.equal(getEventListeners(media, 'change').length, 0);
  // A leaked listener would call set() after disposal and throw.
  document.dispatchEvent(new globalThis.Event('visibilitychange'));
  media.dispatchEvent(new globalThis.Event('change'));
});

it('validates options and preserves replacement/removal and disposal semantics', () => {
  const c = clock();
  for (const options of [
    { fps: 4 },
    { fps: 61 },
    { fps: NaN },
    { minScale: 0 },
    { scaleFactor: 1 },
    { fpsFactor: -1 },
  ]) {
    assert.throws(() => c.governor.add('bad', () => true, options), RangeError);
  }
  const old = c.governor.add('layer', () => true);
  c.governor.add('layer', () => true);
  old();
  assert.deepEqual(c.governor.getQuality('layer'), { scale: 1, fps: 1 });
  c.governor.invalidate('layer');
  c.governor.dispose();
  assert.equal(c.queue.size, 0);
  assert.throws(() => c.governor.invalidate('layer'), /disposed/);
  assert.throws(() => c.governor.add('layer', () => true), /disposed/);
});

it('degrades uncapped effects too, while keeping legacy every-frame draws at full quality', () => {
  const c = clock();
  let draws = 0;
  c.governor.add(
    'layer',
    () => {
      draws++;
      return true;
    },
    { resolution: false }
  );
  c.governor.set({ motion: true });
  c.step(0, 2);
  assert.equal(draws, 2);
  c.step(60, 51);
  assert.deepEqual(c.governor.getQuality('layer'), { scale: 1, fps: 0.25 });
  const before = draws;
  c.step(1000 / 60, 60);
  assert.equal(draws - before, 15);
});

it('uses strict 45 ms slow threshold and accepts the 1000 ms gap boundary', () => {
  const c = running();
  c.step(45, 299);
  assert.deepEqual(c.governor.getQuality('layer'), { scale: 1, fps: 1 });
  c.step(1000);
  assert.deepEqual(c.governor.getQuality('layer'), { scale: 0.7, fps: 1 });
});

it('allows invalidation to bypass a cap and cancellation to remove a queued repaint', () => {
  const c = clock();
  const elapsed = [];
  const remove = c.governor.add(
    'layer',
    (_time, _state, dt) => {
      elapsed.push(dt);
      return true;
    },
    { fps: 5 }
  );
  c.governor.set({ motion: true });
  c.step(0);
  c.governor.invalidate('layer');
  c.step(10);
  assert.deepEqual(elapsed, [0, 0]);
  c.governor.set({ motion: false });
  c.governor.invalidate('layer');
  remove();
  assert.equal(c.queue.size, 0);
});
