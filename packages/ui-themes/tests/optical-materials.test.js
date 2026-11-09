import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  readMaterial,
  materialStyle,
  applyAppearancePreset,
} from '../src/classic/materials.js';

it('keeps the legacy neutral material output', () => {
  assert.deepEqual(
    materialStyle(readMaterial('m: material\n  color red\n  blur 8')),
    {
      background: 'color-mix(in srgb, red 100%, transparent)',
      'backdrop-filter': 'blur(8px)',
      '--material-noise': '0',
      '--material-refraction': '0',
    }
  );
});
it('validates every optical range and preserves filter order', () => {
  const ranges = {
    blur: [0, 48],
    saturation: [100, 300],
    brightness: [70, 150],
    contrast: [50, 200],
    'tint-level': [0, 1],
    highlight: [0, 1],
    depth: [0, 1],
    'depth-blur': [0, 80],
    shadow: [0, 1],
    'shadow-blur': [0, 100],
    'shadow-distance': [0, 60],
    'shadow-spread': [-20, 30],
    sheen: [0, 0.8],
    'sheen-angle': [0, 360],
    'light-angle': [0, 360],
    'border-width': [0, 8],
    'border-light': [0, 1],
  };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    for (const value of [min, max]) {
      assert.doesNotThrow(() => readMaterial(`m: material\n  ${key} ${value}`));
    }
    for (const value of [min - 1, max + 1, NaN, Infinity]) {
      assert.throws(
        () => readMaterial(`m: material\n  ${key} ${value}`),
        RangeError
      );
    }
  }
  const m = readMaterial(
    'm: material\n  blur 12\n  saturation 180\n  brightness 110\n  contrast 120'
  );
  assert.equal(
    materialStyle(m)['backdrop-filter'],
    'blur(12px) saturate(180%) brightness(110%) contrast(120%)'
  );
  assert.throws(
    () => readMaterial('m: material\n  tint invalid-color'),
    TypeError
  );
});
it('suppresses the entire optical layer at zero opacity without touching frame or content', () => {
  const style = materialStyle(
    readMaterial(
      'm: material\n  opacity 0\n  blur 10\n  noise 1\n  sheen 0.8\n  highlight 1\n  border-width 4\n  border-light 1'
    )
  );
  assert.equal(style['backdrop-filter'], 'none');
  assert.equal(style['background-image'], 'none');
  assert.equal(style['box-shadow'], 'none');
  assert.equal(style['border-width'], '4px');
  assert.equal(style.opacity, undefined);
});
it('grain is deterministic, seamless, grayscale and has noise times opacity alpha', () => {
  const m = readMaterial('m: material\n  noise 0.4\n  opacity 0.5');
  const a = materialStyle(m)['background-image'];
  assert.equal(a, materialStyle({ ...m })['background-image']);
  const svg = decodeURIComponent(a.slice(a.indexOf(',') + 1, -2));
  assert.match(svg, /width="128"/u);
  assert.match(svg, /stitchTiles="stitch"/u);
  assert.match(svg, /type="saturate" values="0"/u);
  assert.match(svg, /intercept="0.2"/u);
  assert.equal(
    materialStyle({ ...m, noise: 0 })['background-image'],
    undefined
  );
});
it('scoped presets keep geometry and comfort preferences', () => {
  const current = { corners: 'cut', blur: 0, preferences: { motion: false } };
  assert.deepEqual(
    applyAppearancePreset(
      current,
      { corners: 'round', blur: 20, preferences: { motion: true } },
      ['blur']
    ),
    { ...current, blur: 20 }
  );
});
