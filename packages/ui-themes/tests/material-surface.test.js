import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  readMaterial,
  materialStyle,
  createEffectGovernor,
  applyAppearancePreset,
} from '../src/classic/materials.js';

it('keeps optical layers independent and preserves viewer comfort preferences across presets', () => {
  const material = readMaterial(
    `surface: material\n  opacity 0.4\n  blur 18\n  noise 0.2\n  refraction 0.3\n  color '#123456'\n`
  );
  const preferences = {
    motion: false,
    sound: false,
    volume: 0.13,
    transparency: true,
  };
  const result = applyAppearancePreset(
    { material: { opacity: 1 }, preferences },
    { material, preferences: { sound: true, volume: 1 } }
  );
  assert.deepEqual(result.preferences, preferences);
  const style = materialStyle(result.material, preferences);
  assert.equal(style.opacity, undefined);
  assert.match(style.background, /40%/u);
  assert.equal(style['backdrop-filter'], 'blur(18px)');
  assert.equal(style['--material-noise'], '0.2');
  assert.equal(
    materialStyle(material, { ...preferences, transparency: false })[
      'backdrop-filter'
    ],
    'none'
  );
  assert.match(
    materialStyle(material, { ...preferences, transparency: false }).background,
    /100%/u
  );
  assert.throws(() => readMaterial('m: material\n  opacity 3'), RangeError);
});
it('governs animation and audio without starting frames for static or hidden surfaces', () => {
  const calls = [],
    queued = new Map();
  let id = 0;
  const g = createEffectGovernor({
    requestFrame: (callback) => {
      queued.set(++id, callback);
      return id;
    },
    cancelFrame: (key) => queued.delete(key),
    onSound: (event, volume) => calls.push([event, volume]),
  });
  let draws = 0;
  g.add('shader', () => {
    draws++;
    return draws < 2;
  });
  assert.equal(queued.size, 0);
  g.set({ motion: true, visible: true, sound: true, volume: 0.2 });
  assert.equal(queued.size, 1);
  const tick = () => {
    const [key, callback] = queued.entries().next().value;
    queued.delete(key);
    callback(42);
  };
  tick();
  tick();
  assert.equal(draws, 2);
  assert.equal(queued.size, 0);
  g.sound('press');
  assert.deepEqual(calls, [['press', 0.2]]);
  g.set({ reducedMotion: true, sound: false });
  g.add('noise', () => true);
  assert.equal(queued.size, 0);
  g.sound('press');
  assert.equal(calls.length, 1);
  g.set({ reducedMotion: false });
  assert.equal(queued.size, 1);
  g.set({ visible: false });
  assert.equal(queued.size, 0);
  g.dispose();
});
