/**
 * Typed values back to Links Notation and CSS; every typed value survives
 * `typeValue(parseValue(formatValue(v)))` (#15).
 */

import { describe, it, expect } from 'test-anywhere';
import { values } from '@link-foundation/ui-core';
import { checkTyped } from './helpers.js';

const CASES = [
  ['dimension', { type: 'dimension', value: 16, unit: 'px' }, '16px'],
  ['dimension', { type: 'dimension', value: -0.5, unit: 'rem' }, '-0.5rem'],
  ['dimension', { type: 'dimension', value: 50, unit: '%' }, '50%'],
  ['dimension', { type: 'dimension', value: 0, unit: '' }, '0'],
  ['duration', { type: 'duration', value: 150, unit: 'ms' }, '150ms'],
  ['duration', { type: 'duration', value: 0.2, unit: 's' }, '0.2s'],
  ['number', { type: 'number', value: 1500 }, '1500'],
  ['number', { type: 'number', value: -0.25 }, '-0.25'],
  [
    'color',
    {
      type: 'color',
      space: 'srgb',
      r: 103 / 255,
      g: 80 / 255,
      b: 164 / 255,
      a: 1,
    },
    "'#6750A4'",
  ],
  [
    'color',
    { type: 'color', space: 'srgb', r: 0, g: 0, b: 0, a: 204 / 255 },
    "'#000000CC'",
  ],
  [
    'color',
    { type: 'color', space: 'oklch', l: 0.62, c: 0.19, h: 255, a: 1 },
    '(oklch 0.62 0.19 255)',
  ],
  [
    'color',
    { type: 'color', space: 'srgb', r: 0.5, g: 0, b: 0, a: 0.5 },
    '(rgb 127.5 0 0 0.5)',
  ],
  [
    'color',
    { type: 'token-ref', path: 'color.primary' },
    '(token color.primary)',
  ],
  ['string', { type: 'string', value: 'Links UI demo' }, "'Links UI demo'"],
  ['string', { type: 'string', value: 'Hello' }, 'Hello'],
  ['string', { type: 'string', value: "it's" }, '"it\'s"'],
  ['string', { type: 'param', path: 'draft.text' }, '(param draft.text)'],
  [
    'url',
    { type: 'url', value: 'https://example.com/a.svg' },
    "'https://example.com/a.svg'",
  ],
  ['url', { type: 'url', value: 'hero.png' }, 'hero.png'],
  ['element-ref', { type: 'element-ref', id: 'hello' }, 'hello'],
  [['enum', 'row', 'column'], { type: 'enum', value: 'row' }, 'row'],
  ['boolean', { type: 'boolean', value: true }, 'true'],
  [
    'dimension',
    {
      type: 'fallback',
      options: [
        { type: 'token-ref', path: 'space.large' },
        { type: 'dimension', value: 8, unit: 'px' },
      ],
    },
    '(or (token space.large) 8px)',
  ],
  [
    'action',
    {
      type: 'action',
      name: 'navigate',
      args: [{ type: 'element-ref', id: 'hello' }],
    },
    '(navigate hello)',
  ],
  [
    'any',
    {
      type: 'list',
      items: [
        { type: 'string', value: 'max-width' },
        { type: 'dimension', value: 640, unit: 'px' },
      ],
    },
    '(max-width 640px)',
  ],
];

describe('values: format', () => {
  it('writes canonical Links Notation and reads it back', () => {
    for (const [type, value, text] of CASES) {
      expect([type, values.formatValue(value)]).toEqual([type, text]);
      checkTyped(values, values.toRaw(value), { type }, value, (a, b) =>
        expect(a).toEqual(b)
      );
    }
  });

  it('quotes hex colours so # does not start a comment', () => {
    const value = values.typeValue('#6750A4', { type: 'color' }).value;
    expect(values.formatValue(value)).toBe("'#6750A4'");
    expect(values.parseValue("'#6750A4'")).toBe('#6750A4');
  });

  it('reads exactly one value', () => {
    expect(values.parseValue('(token a.b)')).toEqual(['token', 'a.b']);
    expect(() => values.parseValue('a b')).toThrow();
  });

  it('gives CSS text for every value with a CSS form', () => {
    const css = CASES.map(([, value]) => values.toCss(value));
    expect(css).toEqual([
      '16px',
      '-0.5rem',
      '50%',
      '0',
      '150ms',
      '0.2s',
      '1500',
      '-0.25',
      '#6750A4',
      '#000000CC',
      'oklch(0.62 0.19 255)',
      'rgb(127.5 0 0 / 0.5)',
      'var(--color-primary)',
      'Links UI demo',
      'Hello',
      "it's",
      'var(--param-draft-text)',
      'url("https://example.com/a.svg")',
      'url("hero.png")',
      'hello',
      'row',
      'true',
      'var(--space-large, 8px)',
      null,
      'max-width 640px',
    ]);
  });
});
