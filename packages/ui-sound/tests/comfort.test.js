import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { createConfig, persistUserLayer } from '@link-foundation/ui-config';
import {
  readSchema,
  applyPreset,
  applySharedLook,
  randomize,
} from '@link-foundation/ui-settings';
import { bindSoundConfig, SOUND_SETTINGS_LINO } from '../src/comfort.js';

const document = () => parse('settings: box');
describe('viewer sound comfort', () => {
  it('keeps both comfort keys through presets, shared looks and randomizing', () => {
    const { schema, diagnostics } = readSchema(`${SOUND_SETTINGS_LINO}
color:
  type choice
  default blue
  options blue red
preset other
  set color red
`);
    expect(diagnostics).toEqual([]);
    const viewer = {
      'sound.enabled': true,
      'sound.volume': 0.23,
      color: 'blue',
    };
    for (const result of [
      applyPreset(schema, viewer, 'other'),
      applySharedLook(schema, viewer, {
        'sound.enabled': false,
        'sound.volume': 1,
        color: 'red',
      }),
      randomize(schema, viewer, { random: () => 0.9 }),
    ]) {
      expect(result['sound.enabled']).toBe(true);
      expect(result['sound.volume']).toBe(0.23);
      expect(result.color).toBe('red');
    }
  });
  it('writes to #18 user overrides and restores volume after reload', () => {
    const data = new Map();
    const storage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    };
    const config = createConfig({ document: document() });
    const persist = persistUserLayer(config, storage);
    const binding = bindSoundConfig(config);
    expect(binding.get('sound.enabled')).toBe(false);
    binding.set('sound.enabled', true);
    binding.set('sound.volume', 0.23);
    expect(config.resolve('settings', 'sound.enabled').layer).toBe('user');
    const reloaded = createConfig({ document: document() });
    const restored = persistUserLayer(reloaded, storage);
    expect(bindSoundConfig(reloaded).get('sound.volume')).toBe(0.23);
    expect(bindSoundConfig(reloaded).get('sound.enabled')).toBe(true);
    persist.stop();
    restored.stop();
  });
});
