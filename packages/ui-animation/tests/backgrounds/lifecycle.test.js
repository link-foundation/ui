import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount as stars } from '../../src/backgrounds/starfield.js';
import { mount as beams } from '../../src/backgrounds/beams.js';
import { mount as rain } from '../../src/backgrounds/rain.js';
import { environment } from './helpers.js';

for (const [name, mount] of Object.entries({ stars, beams, rain })) {
  test(`${name}: DPR, late stylesheet resize, identical resize and pause`, () => {
    const e = environment();
    const layer = mount(e.canvas, { animate: false });
    assert.equal(e.canvas.width, 600);
    e.resize(800, 600);
    assert.equal(e.canvas.width, 1600);
    assert.equal(e.canvas.height, 1200);
    const n = e.calls.length;
    e.resize(800, 600);
    layer.update({ label: 'non visual', fps: 25 });
    layer.animate(false);
    assert.equal(e.calls.length, n);
    layer.animate(true);
    e.tick(0);
    e.tick(50);
    layer.animate(false);
    const frozen = e.calls.length;
    e.tick(10000);
    assert.equal(e.calls.length, frozen);
    assert.equal(e.frames.size, 0);
    layer.animate(true);
    e.tick(20000);
    layer.dispose();
    assert.equal(e.frames.size, 0);
  });
  test(`${name}: hidden and reduced motion stop scheduling`, () => {
    const e = environment();
    const layer = mount(e.canvas);
    e.doc.hidden = true;
    e.event('visibilitychange');
    assert.equal(e.frames.size, 0);
    e.doc.hidden = false;
    e.event('visibilitychange');
    layer.update({ reducedMotion: true });
    assert.equal(e.frames.size, 0);
    const still = e.calls.length;
    e.tick(5000);
    assert.equal(e.calls.length, still);
    layer.dispose();
  });
}

test('future timing options repaint nothing while paused', () => {
  for (const [mount, partial] of [
    [stars, { spin: 60, twinkleRate: 3 }],
    [beams, { speed: 400, pause: 8 }],
    [rain, { step: 80, fade: 0.1, restart: 0.4, columnSteps: 8 }],
  ]) {
    const e = environment();
    const layer = mount(e.canvas, { animate: false });
    const n = e.calls.length;
    layer.update(partial);
    assert.equal(e.calls.length, n);
    layer.dispose();
  }
});

test('star drift and spin freeze through a long pause and resume without a jump', () => {
  const e = environment({ width: 1920, height: 1080 });
  const layer = stars(e.canvas, {
    count: 1,
    motion: 'drift',
    direction: 0,
    speed: 100,
    spin: 90,
  });
  e.tick(0);
  e.tick(100);
  const position = () =>
    e.calls.filter(([name]) => name === 'translate').at(-1);
  const rotation = () => e.calls.filter(([name]) => name === 'rotate').at(-1);
  const frozen = [position(), rotation()];
  layer.animate(false);
  layer.animate(true);
  e.tick(10000);
  assert.deepEqual([position(), rotation()], frozen);
  e.tick(10100);
  assert.notDeepEqual(position(), frozen[0]);
  layer.dispose();
});

test('hidden visual updates repaint once on visibility and DPR changes rebuild once', () => {
  const e = environment();
  const layer = stars(e.canvas, { animate: false });
  e.doc.hidden = true;
  e.event('visibilitychange');
  const n = e.calls.length;
  layer.update({ color: '#ccbb11' });
  assert.equal(e.calls.length, n);
  e.doc.hidden = false;
  e.event('visibilitychange');
  assert.ok(e.calls.length > n);
  const prior = e.calls.length;
  e.win.devicePixelRatio = 1.5;
  e.event('resize');
  assert.equal(e.canvas.width, 450);
  assert.ok(e.calls.length > prior);
  const resized = e.calls.length;
  e.event('resize');
  assert.equal(e.calls.length, resized);
  layer.dispose();
});

test('rain simulation starts on the first quantized step and invalidation never fades', () => {
  for (const [hz, count] of [
    [60, 6],
    [120, 13],
  ]) {
    const e = environment();
    const layer = rain(e.canvas, { step: 105, adaptive: false });
    e.tick(0);
    const fades = () => e.calls.filter(([name]) => name === 'fillRect').length;
    for (let i = 1; i < count; i++) {
      e.tick((i * 1000) / hz);
    }
    assert.equal(fades(), 0);
    e.tick((count * 1000) / hz);
    assert.equal(fades(), 1);
    layer.update({ color: '#aabbcc', drift: 12 });
    assert.equal(fades(), 1);
    layer.dispose();
  }
});
