import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  webLightTheme,
  webDarkTheme,
  createLightTheme,
  createDarkTheme,
} from '@fluentui/tokens';
import { values } from '@link-foundation/ui-core';
import { loadThemes, resolveTheme } from '@link-foundation/ui-tokens/themes';
import {
  loadTheme,
  fluentBrandRamp,
  fluentThemeFromBrand,
} from '../src/index.js';
import { fluentTokenPath } from '../src/fluent2/names.js';
import { BRAND_ALIASES } from '../src/fluent2/brand-aliases.js';
const ramp = {
  10: '#061724',
  20: '#082338',
  30: '#0a2e4a',
  40: '#0c3b5e',
  50: '#0e4775',
  60: '#0f548c',
  70: '#115ea3',
  80: '#0f6cbd',
  90: '#2886de',
  100: '#479ef5',
  110: '#62abf5',
  120: '#77b7f7',
  130: '#96c6fa',
  140: '#b4d6fa',
  150: '#cfe4fa',
  160: '#ebf3fc',
};
it('reproduces every upstream light/dark brand alias from the default ramp', async () => {
  const base = await loadTheme('fluent2');
  const loaded = loadThemes(fluentThemeFromBrand(ramp));
  assert.deepEqual(loaded.diagnostics, []);
  const theme = resolveTheme(
    new Map([...base.chain, ...loaded.themes].map((t) => [t.id, t])),
    'fluent2-brand'
  );
  assert.deepEqual(theme.diagnostics, []);
  for (const [mode, input, factory] of [
    ['light', webLightTheme, createLightTheme],
    ['dark', webDarkTheme, createDarkTheme],
  ]) {
    const tokens = mode === 'light' ? theme.tokens : theme.modes.dark;
    for (const name of Object.keys(BRAND_ALIASES[mode])) {
      assert.equal(factory(ramp)[name], input[name], name);
      assert.equal(
        values.toHex(tokens.get(fluentTokenPath(name))).toLowerCase(),
        input[name],
        `${mode}/${name}`
      );
    }
  }
  assert.equal(BRAND_ALIASES.dark.colorBrandBackground, 70);
  assert.equal(BRAND_ALIASES.light.colorBrandBackground, 80);
  assert.deepEqual(theme.modes['high-contrast'], base.modes['high-contrast']);
});
it('interpolates deterministic monotonic 16-stop OKLCH ramps including saturated and neutral seeds', () => {
  for (const seed of [
    '#0067c0',
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#808080',
    '#ffffff',
    '#000000',
  ]) {
    const result = fluentBrandRamp(seed);
    assert.deepEqual(result, fluentBrandRamp(seed));
    assert.equal(Object.keys(result).length, 16);
    let previous = 0;
    for (const color of Object.values(result)) {
      const l = values.srgbToOklch(values.parseColor(color)).l;
      assert.ok(l > previous, seed);
      previous = l;
    }
    assert.equal(loadThemes(fluentThemeFromBrand(seed)).diagnostics.length, 0);
  }
});
it('rejects missing, extra, translucent or malformed brand stops and unsafe ids', () => {
  for (const input of [
    null,
    {},
    { ...ramp, 10: 'red' },
    { ...ramp, 170: '#ffffff' },
    { ...ramp, 10: '#12345678' },
    '#xyz',
    'red',
  ]) {
    assert.throws(() => fluentThemeFromBrand(input), TypeError);
  }
  for (const id of ['fluent2', 'bad id', '', '</style>']) {
    assert.throws(() => fluentThemeFromBrand(ramp, { id }), TypeError);
  }
});
