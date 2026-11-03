/**
 * color: the hex text of color-field, normalised to `#rrggbb`.
 */

import { describe, it, expect } from 'test-anywhere';
import { formatHex, parseHex } from '../../src/controls/color.js';

describe('formatHex', () => {
  it('normalises six and three digit colours to lower-case #rrggbb', () => {
    expect(formatHex('#1A73E8')).toBe('#1a73e8');
    expect(formatHex('1a73e8')).toBe('#1a73e8');
    expect(formatHex('#F0a')).toBe('#ff00aa');
    expect(formatHex('  #abc ')).toBe('#aabbcc');
  });

  it('gives null for anything else', () => {
    for (const bad of [
      '',
      '#',
      '#12',
      '#12345',
      '#1234567',
      'red',
      '#ggg',
      7,
    ]) {
      expect(formatHex(bad)).toBe(null);
    }
  });
});

describe('parseHex', () => {
  it('reads the channels', () => {
    expect(parseHex('#ff8000')).toEqual({ r: 255, g: 128, b: 0 });
    expect(parseHex('nope')).toBe(null);
  });
});
