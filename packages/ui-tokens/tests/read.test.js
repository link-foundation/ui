/**
 * `readTokens(text)`: token sets in Links Notation, with every problem a
 * diagnostic.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'test-anywhere';
import {
  readTokens,
  isTokenPath,
  typeTokenValue,
} from '@link-foundation/ui-tokens';
import { FULL, SAMPLE, codes } from './helpers.js';

describe('readTokens: the issue-1 sample', () => {
  const { sets, diagnostics } = readTokens(readFileSync(SAMPLE, 'utf8'));
  const set = sets.get('material3');

  it('reads one set without diagnostics', () => {
    expect([...sets.keys()]).toEqual(['material3']);
    expect(diagnostics).toEqual([]);
    expect(set.extends).toEqual(['base']);
  });

  it('gives 5 tokens typed color, color, dimension, dimension, duration', () => {
    expect(set.tokens.length).toBe(5);
    expect(set.tokens.map((t) => t.type)).toEqual([
      'color',
      'color',
      'dimension',
      'dimension',
      'duration',
    ]);
    expect(set.tokens.map((t) => t.path)).toEqual([
      'color.primary',
      'color.on-primary',
      'space.medium',
      'shape.corner.medium',
      'motion.duration.short',
    ]);
    expect(set.tokens[2].value).toEqual({
      type: 'dimension',
      value: 16,
      unit: 'px',
    });
    expect(set.tokens[4].value).toEqual({
      type: 'duration',
      value: 150,
      unit: 'ms',
    });
  });
});

describe('readTokens: forms and grammar', () => {
  const oneLine =
    "(m3: theme (extends base) (token color.primary '#6750A4' (description 'Brand')) (token color.action (token color.primary)) (mode dark (token color.primary '#D0BCFF')))";
  const multiLine = `(m3: theme
  (extends base)
  (token color.primary '#6750A4' (description 'Brand'))
  (token color.action (token color.primary))
  (mode dark
    (token color.primary '#D0BCFF')))`;
  const indented = `m3: theme
  extends base
  token color.primary '#6750A4' (description 'Brand')
  token color.action (token color.primary)
  mode dark
    token color.primary '#D0BCFF'`;

  it('reads the one-line, multi-line and indented forms alike', () => {
    const read = (text) => {
      const { sets, diagnostics } = readTokens(text);
      expect(diagnostics).toEqual([]);
      return sets.get('m3');
    };
    const expected = {
      id: 'm3',
      extends: ['base'],
      tokens: [
        {
          path: 'color.primary',
          type: 'color',
          value: {
            type: 'color',
            space: 'srgb',
            r: 0x67 / 255,
            g: 0x50 / 255,
            b: 0xa4 / 255,
            a: 1,
          },
          description: 'Brand',
        },
        {
          path: 'color.action',
          type: null,
          value: { type: 'token-ref', path: 'color.primary' },
        },
      ],
      modes: {
        dark: [
          {
            path: 'color.primary',
            type: 'color',
            value: {
              type: 'color',
              space: 'srgb',
              r: 0xd0 / 255,
              g: 0xbc / 255,
              b: 1,
              a: 1,
            },
            mode: 'dark',
          },
        ],
      },
    };
    expect(read(oneLine)).toEqual(expected);
    expect(read(multiLine)).toEqual(expected);
    expect(read(indented)).toEqual(expected);
  });

  it('reads every type, declared or inferred', () => {
    const { sets, diagnostics } = readTokens(readFileSync(FULL, 'utf8'));
    expect(diagnostics).toEqual([]);
    const types = Object.fromEntries(
      sets.get('brand').tokens.map((t) => [t.path, t.type])
    );
    expect(types).toEqual({
      'color.primary': 'color',
      'color.on-primary': 'color',
      'color.action': null,
      'color.scrim': 'color',
      'color.accent': 'color',
      'space.medium': 'dimension',
      'space.gap': null,
      'size.root': 'dimension',
      'motion.duration.short': 'duration',
      'motion.easing.standard': 'cubicBezier',
      'opacity.disabled': 'number',
      'font.family.body': 'fontFamily',
      'font.weight.regular': 'fontWeight',
      'elevation.low': 'shadow',
      'elevation.high': 'shadow',
      'type.body': 'typography',
    });
    expect(sets.get('base').tokens.map((t) => t.type)).toEqual([
      'color',
      'dimension',
      'fontWeight',
    ]);
  });

  it('types composites field by field, aliases included', () => {
    const typography = typeTokenValue([
      'typography',
      ['font-family', 'Roboto', 'sans-serif'],
      ['font-size', '1rem'],
      ['font-weight', 'semi-bold'],
      ['letter-spacing', '0'],
      ['line-height', ['token', 'line.normal']],
    ]);
    expect(typography).toEqual({
      type: 'typography',
      value: {
        fontFamily: { type: 'fontFamily', value: ['Roboto', 'sans-serif'] },
        fontSize: { type: 'dimension', value: 1, unit: 'rem' },
        fontWeight: { type: 'fontWeight', value: 'semi-bold' },
        letterSpacing: { type: 'dimension', value: 0, unit: 'px' },
        lineHeight: { type: 'token-ref', path: 'line.normal' },
      },
    });
    expect(typeTokenValue(['shadow', ['color', '#000']])).toBe(null);
    expect(typeTokenValue(['cubic-bezier', '0.2', '0', '1.2', '1'])).toBe(null);
    expect(typeTokenValue('12em', 'dimension')).toBe(null);
    expect(typeTokenValue('1001', 'fontWeight')).toBe(null);
    expect(typeTokenValue('400', 'number')).toEqual({
      type: 'number',
      value: 400,
    });
  });

  it('accepts DTCG token names and rejects the reserved characters', () => {
    expect(isTokenPath('color.on-primary')).toBe(true);
    expect(isTokenPath('Space.2XL')).toBe(true);
    expect(isTokenPath('color.$root')).toBe(false);
    expect(isTokenPath('a..b')).toBe(false);
    expect(isTokenPath('a{b}')).toBe(false);
  });
});

describe('readTokens: diagnostics, never exceptions', () => {
  it('reports bad tokens and keeps the good ones', () => {
    const { sets, diagnostics } = readTokens(`(t: theme
  (token ok 1px)
  (token bad.value 12em)
  (token bad.type 1px (type colour))
  (token not.typed 1px (type color))
  (token $bad 1px)
  (token lonely)
  (token ok 2px)
  (mode dark (token ok 3px) (oops)))
(theme (token x 1px))`);
    expect(codes(diagnostics)).toEqual([
      'invalid-value',
      'unknown-type',
      'invalid-value',
      'invalid-token',
      'invalid-token',
      'duplicate-token',
      'invalid-token',
      'anonymous-set',
    ]);
    expect(diagnostics.find((d) => d.code === 'duplicate-token').severity).toBe(
      'warning'
    );
    const set = sets.get('t');
    expect(set.tokens).toEqual([
      {
        path: 'ok',
        type: 'dimension',
        value: { type: 'dimension', value: 2, unit: 'px' },
      },
    ]);
    expect(set.modes.dark.map((t) => t.path)).toEqual(['ok']);
  });

  it('forwards syntax errors of the parser', () => {
    const { sets, diagnostics } = readTokens('(t: theme (token a 1px)');
    expect(codes(diagnostics)).toContain('syntax-error');
    expect(sets.size).toBe(0);
  });

  it('reads only theme elements', () => {
    const { sets } = readTokens(
      '(page: stack (label x))\n(t: theme (token a 1px))'
    );
    expect([...sets.keys()]).toEqual(['t']);
  });
});
