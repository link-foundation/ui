import { describe, it, expect } from 'test-anywhere';

import {
  countCustomized,
  defaults,
  diff,
  equalValues,
  isDefault,
  merge,
  reset,
  toLino,
} from '../src/index.js';
import { demoSchema } from './helpers.js';

const schema = demoSchema();

describe('values', () => {
  it('has a default for every field', () => {
    expect(defaults(schema)).toEqual({
      'liquid.blur': 18,
      'theme.mode': 'auto',
      'motion.reduce': false,
      accent: '#3390EC',
    });
  });

  it('merges only known, valid values', () => {
    const { values, rejected } = merge(schema, undefined, {
      'liquid.blur': 24,
      evil: 'x',
      'theme.mode': 7,
    });
    expect(values).toEqual({ ...defaults(schema), 'liquid.blur': 24 });
    expect(rejected).toEqual(['evil', 'theme.mode']);
  });

  it('writes the diff only', () => {
    const { values } = merge(schema, undefined, {
      'liquid.blur': 24,
      evil: 'x',
      'theme.mode': 7,
    });
    expect(diff(schema, values)).toEqual({ 'liquid.blur': 24 });
    expect(toLino(schema, diff(schema, values))).toBe(
      'settings\n  version 2\n  liquid.blur 24'
    );
  });

  it('never throws on hostile input', () => {
    const hostile = JSON.parse('{"__proto__": {"x": 1}, "accent": "#000000"}');
    const getter = {
      get accent() {
        throw new Error('no');
      },
    };
    for (const input of [null, 42, 'text', [1, 2], hostile, getter]) {
      expect(() => merge(schema, undefined, input)).not.toThrow();
    }
    expect(merge(schema, undefined, hostile).values.accent).toBe('#000000');
    expect(merge(schema, undefined, hostile).rejected).toEqual(['__proto__']);
    expect({}.x).toBeUndefined();
  });

  it('merges onto a base', () => {
    const base = { 'theme.mode': 'dark', 'liquid.blur': 'bad' };
    expect(merge(schema, base, { accent: '#111111' }).values).toEqual({
      'liquid.blur': 18,
      'theme.mode': 'dark',
      'motion.reduce': false,
      accent: '#111111',
    });
  });

  it('tells defaults apart', () => {
    expect(isDefault(schema, 'liquid.blur', 18)).toBe(true);
    expect(isDefault(schema, 'accent', '#3390ec')).toBe(true);
    expect(isDefault(schema, 'accent', '#3390ed')).toBe(false);
    expect(isDefault(schema, 'nope', 1)).toBe(false);
  });

  it('resets some or all keys and counts customised values', () => {
    const values = { 'liquid.blur': 30, 'theme.mode': 'dark' };
    expect(countCustomized(schema, values)).toBe(2);
    expect(reset(schema, values, ['liquid.blur'])).toEqual({
      ...defaults(schema),
      'theme.mode': 'dark',
    });
    expect(reset(schema, values)).toEqual(defaults(schema));
    expect(countCustomized(schema, reset(schema, values))).toBe(0);
  });

  it('compares values field by field', () => {
    expect(
      equalValues(
        schema,
        { 'theme.mode': 'dark', 'liquid.blur': 24 },
        { 'liquid.blur': 24, 'theme.mode': 'dark', accent: '#3390ec' }
      )
    ).toBe(true);
    expect(equalValues(schema, { 'liquid.blur': 24 }, {})).toBe(false);
  });
});
