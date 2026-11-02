import { describe, it, expect } from 'test-anywhere';

import {
  activePreset,
  applyPreset,
  applySharedLook,
  defaults,
} from '../src/index.js';
import { demoSchema } from './helpers.js';

const schema = demoSchema();

describe('presets', () => {
  it('finds the active preset whatever the key order', () => {
    expect(
      activePreset(schema, { 'liquid.blur': 24, 'theme.mode': 'dark' })
    ).toBe('calm');
    expect(
      activePreset(schema, { 'theme.mode': 'dark', 'liquid.blur': 24 })
    ).toBe('calm');
  });

  it('ignores comfort fields when matching and returns null otherwise', () => {
    expect(
      activePreset(schema, {
        'liquid.blur': 24,
        'theme.mode': 'dark',
        'motion.reduce': true,
      })
    ).toBe('calm');
    expect(activePreset(schema, defaults(schema))).toBeNull();
    expect(
      activePreset(schema, {
        'liquid.blur': 24,
        'theme.mode': 'dark',
        accent: '#000000',
      })
    ).toBeNull();
  });

  it('keeps the comfort settings of the viewer', () => {
    const viewer = { 'motion.reduce': true, accent: '#000000' };
    const out = applyPreset(schema, viewer, 'calm');
    expect(out).toEqual({
      'liquid.blur': 24,
      'theme.mode': 'dark',
      'motion.reduce': true,
      accent: '#3390EC',
    });
    expect(activePreset(schema, out)).toBe('calm');
  });

  it('throws on an unknown preset', () => {
    expect(() => applyPreset(schema, {}, 'nope')).toThrow();
  });

  it('applies a shared look over the viewer', () => {
    expect(
      applySharedLook(
        schema,
        { 'motion.reduce': true, 'liquid.blur': 2 },
        { 'motion.reduce': false, accent: '#ffffff' }
      )
    ).toEqual({
      'liquid.blur': 18,
      'theme.mode': 'auto',
      'motion.reduce': true,
      accent: '#ffffff',
    });
  });
});
