/**
 * Colours: quoted hex, `(rgb ...)`, `(oklch ...)` and the oklch <-> sRGB
 * conversion (#15).
 */

import { describe, it, expect } from 'test-anywhere';
import { parse, values } from '@link-foundation/ui-core';
import { checkTyped, seededRandom } from './helpers.js';

const color = (raw, expected) =>
  checkTyped(values, raw, { type: 'color' }, expected, (a, b) =>
    expect(a).toEqual(b)
  );

const srgb = (r, g, b, a = 1) => ({ type: 'color', space: 'srgb', r, g, b, a });
const oklch = (l, c, h, a = 1) => ({
  type: 'color',
  space: 'oklch',
  l,
  c,
  h,
  a,
});

/** The smallest distance between two hues, in degrees. */
const hueDistance = (x, y) => {
  const d = Math.abs(x - y) % 360;
  return Math.min(d, 360 - d);
};

describe('values: colours', () => {
  it('reads quoted hex colours of every length', () => {
    color('#6750A4', srgb(103 / 255, 80 / 255, 164 / 255));
    color('#6750A4CC', srgb(103 / 255, 80 / 255, 164 / 255, 204 / 255));
    color('#FFF', srgb(1, 1, 1));
    color('#0af8', srgb(0, 170 / 255, 1, 136 / 255));
  });

  it('reads (rgb r g b) and (oklch l c h), with an optional alpha', () => {
    color(['rgb', '103', '80', '164'], srgb(103 / 255, 80 / 255, 164 / 255));
    color(['rgb', '127.5', '0', '0', '0.5'], srgb(0.5, 0, 0, 0.5));
    color(['oklch', '0.62', '0.19', '255'], oklch(0.62, 0.19, 255));
    color(['oklch', '0.6', '0.2', '300', '0.8'], oklch(0.6, 0.2, 300, 0.8));
    expect(values.parseColor(['oklch', '70%', '50%', '200', '50%'])).toEqual(
      oklch(0.7, 0.2, 200, 0.5)
    );
    expect(values.parseColor(['rgb', '100%', '0%', '0%'])).toEqual(
      srgb(1, 0, 0)
    );
  });

  it('parses (oklch 0.62 0.19 255) from a document', () => {
    const doc = parse('(accent: style (background (oklch 0.62 0.19 255)))');
    const [raw] = doc.roots[0].properties[0].values;
    expect(values.typeValue(raw, { type: 'color' }).value).toEqual(
      oklch(0.62, 0.19, 255)
    );
  });

  it('rejects what is not a colour', () => {
    for (const raw of [
      '#12345',
      '#GGGGGG',
      '6750A4',
      ['hsl', '1', '2', '3'],
      ['rgb', '1', '2'],
      ['oklch', 'a', 'b', 'c'],
      [['rgb'], '1', '2', '3'],
    ]) {
      expect([raw, values.parseColor(raw)]).toEqual([raw, null]);
    }
  });

  it('writes hex as upper case, with alpha only when not opaque', () => {
    expect(values.toHex(srgb(1, 1, 1))).toBe('#FFFFFF');
    expect(values.toHex(srgb(0, 0, 0, 0.8))).toBe('#000000CC');
    expect(values.toHex(srgb(1.2, -0.1, 0.5))).toBe('#FF0080');
    expect(values.toHex(oklch(1, 0, 0))).toBe('#FFFFFF');
    expect(values.toHex(oklch(0, 0, 0))).toBe('#000000');
    expect(values.formatColor(srgb(1, 1, 1))).toBe("'#FFFFFF'");
    expect(values.formatColor(oklch(0.6, 0.2, 300))).toBe(
      '(oklch 0.6 0.2 300)'
    );
    expect(values.formatColor(srgb(0.5, 0, 0))).toBe('(rgb 127.5 0 0)');
  });

  it('converts known colours between sRGB and oklch', () => {
    // Reference values from CSS Color 4 / Ottosson's examples.
    const white = values.srgbToOklch(srgb(1, 1, 1));
    expect(Math.abs(white.l - 1)).toBeLessThan(1e-6);
    expect(white.c).toBeLessThan(1e-6);
    const red = values.srgbToOklch(srgb(1, 0, 0));
    expect(Math.abs(red.l - 0.62796)).toBeLessThan(1e-4);
    expect(Math.abs(red.c - 0.25768)).toBeLessThan(1e-4);
    expect(Math.abs(red.h - 29.2339)).toBeLessThan(1e-3);
    expect(values.toHex(oklch(0.62796, 0.25768, 29.2339))).toBe('#FF0000');
  });

  it('round-trips 20 in-gamut oklch colours within 0.001 per channel', () => {
    const random = seededRandom(15);
    let checked = 0;
    while (checked < 20) {
      const c = oklch(
        0.2 + random() * 0.7,
        0.02 + random() * 0.2,
        random() * 360
      );
      const rgb = values.oklchToSrgb(c);
      const inGamut = [rgb.r, rgb.g, rgb.b].every((x) => x >= 0 && x <= 1);
      if (!inGamut) {
        continue;
      }
      const back = values.srgbToOklch(rgb);
      const errors = [
        Math.abs(back.l - c.l),
        Math.abs(back.c - c.c),
        hueDistance(back.h, c.h),
        Math.abs(back.a - c.a),
      ];
      expect([c, errors.every((e) => e < 0.001)]).toEqual([c, true]);
      checked++;
    }
    expect(checked).toBe(20);
  });

  it('gives CSS colour text', () => {
    expect(values.toCss(srgb(103 / 255, 80 / 255, 164 / 255))).toBe('#6750A4');
    expect(values.toCss(oklch(0.6, 0.2, 300))).toBe('oklch(0.6 0.2 300)');
    expect(values.toCss(oklch(0.6, 0.2, 300, 0.5))).toBe(
      'oklch(0.6 0.2 300 / 0.5)'
    );
    expect(values.toCss(srgb(0.5, 0, 0, 0.25))).toBe('rgb(127.5 0 0 / 0.25)');
  });
});
