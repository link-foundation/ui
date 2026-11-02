/**
 * `resolveStyle`: the style of one element in a state and an environment,
 * tokens resolved (the path of native renderers).
 */

import { describe, it, expect } from 'test-anywhere';
import { values } from '@link-foundation/ui-core';
import { readStyles, resolveStyle } from '@link-foundation/ui-style';
import {
  codes,
  fixtureStyles,
  node,
  sampleDocument,
  sampleStyles,
  sampleTokens,
} from './helpers.js';

describe('resolveStyle: the issue-1 samples', () => {
  const { rules } = sampleStyles();
  const tokens = sampleTokens();
  const { ok, okAncestors } = sampleDocument();

  it('resolves the ok button on hover: #6750A4 and elevation 2', () => {
    const { style, sources, diagnostics } = resolveStyle(
      rules,
      tokens,
      ok,
      okAncestors,
      { states: ['hover'] }
    );
    expect(diagnostics).toEqual([]);
    expect(style.background.type).toBe('color');
    expect(values.toHex(style.background)).toBe('#6750A4');
    expect(values.toHex(style.color)).toBe('#FFFFFF');
    expect(style.radius).toEqual({ type: 'dimension', value: 12, unit: 'px' });
    expect(style.elevation).toEqual({ type: 'number', value: 2 });
    expect(style.scale).toBeUndefined();
    expect(sources.elevation).toBe('button-style');
  });

  it('has no elevation without hover', () => {
    const { style } = resolveStyle(rules, tokens, ok, okAncestors);
    expect(values.toHex(style.background)).toBe('#6750A4');
    expect(style.elevation).toBeUndefined();
    expect(Object.keys(style)).toEqual(['background', 'color', 'radius']);
  });

  it('gives the pressed scale when pressed', () => {
    const { style } = resolveStyle(rules, tokens, ok, okAncestors, {
      states: ['pressed'],
    });
    expect(style.scale).toEqual({ type: 'number', value: 0.98 });
    expect(style.elevation).toBeUndefined();
  });

  it('gives nothing to an element the selector does not match', () => {
    const { doc } = sampleDocument();
    expect(resolveStyle(rules, tokens, doc.byId.get('greeting')).style).toEqual(
      {}
    );
  });
});

describe('resolveStyle: conditions', () => {
  const { rules } = fixtureStyles('card.lino');
  const tokens = new Map([
    ['space.medium', { type: 'dimension', value: 16, unit: 'px' }],
    ['space.small', { type: 'dimension', value: 8, unit: 'px' }],
  ]);
  const card = node('card');
  const dialog = [node('dialog')];
  const padding = (env) =>
    resolveStyle(rules, tokens, card, dialog, env).style.padding.value;

  it('applies media (max-width 640px) at 640 but not at 641', () => {
    expect(padding({ viewport: { width: 640 } })).toBe(8);
    expect(padding({ viewport: { width: 641 } })).toBe(16);
    expect(padding({})).toBe(16);
  });

  it('applies container (min-width 400px) at 400 but not at 399', () => {
    const direction = (width) =>
      resolveStyle(rules, tokens, card, dialog, { container: { width } }).style
        .direction;
    expect(direction(400)).toEqual({ type: 'enum', value: 'horizontal' });
    expect(direction(399)).toBeUndefined();
    expect(
      resolveStyle(rules, tokens, card, dialog, { viewport: { width: 400 } })
        .style.direction
    ).toBeUndefined();
  });

  it('applies the colour scheme and reduced motion together', () => {
    const outline = values.parseColor('#79747E');
    const withOutline = new Map([...tokens, ['color.outline', outline]]);
    const border = (env) =>
      resolveStyle(rules, withOutline, card, dialog, env).style['border-color'];
    expect(border({})).toBeUndefined();
    expect(border({ colorScheme: 'dark' })).toBeUndefined();
    expect(border({ reducedMotion: true })).toBeUndefined();
    expect(border({ colorScheme: 'dark', reducedMotion: true })).toEqual(
      outline
    );
  });

  it('nests states in media blocks', () => {
    const opacity = (env) =>
      resolveStyle(rules, tokens, card, dialog, env).style.opacity;
    expect(opacity({ viewport: { width: 600 }, states: ['hover'] })).toEqual({
      type: 'number',
      value: 0.92,
    });
    expect(
      opacity({ viewport: { width: 700 }, states: ['hover'] })
    ).toBeUndefined();
    expect(opacity({ viewport: { width: 600 } })).toBeUndefined();
    expect(
      opacity({ viewport: { width: 600 }, states: ['hover', 'disabled'] }).value
    ).toBe(0.38);
  });

  it('needs the within ancestor', () => {
    expect(resolveStyle(rules, tokens, card).style).toEqual({});
  });

  it('measures rem widths with a 16px root font size', () => {
    const rem = readStyles(
      '(r: style (selector (type x)) (media (min-width 40rem) (opacity 0.5)))'
    ).rules;
    const at = (width) =>
      resolveStyle(rem, tokens, node('x'), [], { viewport: { width } }).style
        .opacity;
    expect(at(640)).toEqual({ type: 'number', value: 0.5 });
    expect(at(639)).toBeUndefined();
  });
});

describe('resolveStyle: tokens', () => {
  const x = node('x');

  it('reports unknown tokens and type mismatches, and drops the value', () => {
    const { rules } = readStyles(`(r: style
  (selector (type x))
  (background (token missing))
  (padding (token color.primary))
  (opacity 0.5))`);
    const { style, diagnostics } = resolveStyle(rules, sampleTokens(), x);
    expect(codes(diagnostics)).toEqual(['unknown-token', 'type-mismatch']);
    expect(diagnostics[0].at).toEqual({
      rule: 'r',
      property: 'background',
      token: 'missing',
    });
    expect(diagnostics[1].at.actual).toBe('color');
    expect(Object.keys(style)).toEqual(['opacity']);
  });

  it('takes the first option of a fallback that resolves', () => {
    const { rules } = readStyles(`(r: style
  (selector (type x))
  (background (or (token missing) (token color.primary)))
  (color (or (token missing) '#00FF00'))
  (radius (or (token missing) (token also-missing))))`);
    const { style, diagnostics } = resolveStyle(rules, sampleTokens(), x);
    expect(values.toHex(style.background)).toBe('#6750A4');
    expect(values.toHex(style.color)).toBe('#00FF00');
    expect(style.radius).toBeUndefined();
    expect(codes(diagnostics)).toEqual(['unknown-token']);
    expect(diagnostics[0].at.token).toBe('also-missing');
  });

  it('resolves every item of a list', () => {
    const { rules } = readStyles(
      '(r: style (selector (type x)) (padding (token s) 2px))'
    );
    const tokens = new Map([
      ['s', { type: 'dimension', value: 4, unit: 'px' }],
    ]);
    expect(resolveStyle(rules, tokens, x).style.padding).toEqual({
      type: 'list',
      items: [
        { type: 'dimension', value: 4, unit: 'px' },
        { type: 'dimension', value: 2, unit: 'px' },
      ],
    });
  });
});
