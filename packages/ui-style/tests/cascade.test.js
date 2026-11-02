/**
 * The cascade of `resolveStyle`: specificity first, then the later rule —
 * the order a browser applies to the stylesheet `compileCss` writes.
 */

import { describe, it, expect } from 'test-anywhere';
import { values } from '@link-foundation/ui-core';
import { readStyles, resolveStyle } from '@link-foundation/ui-style';
import { fixtureStyles, node } from './helpers.js';

const { rules } = fixtureStyles('cascade.lino');
const tokens = new Map();
const resolve = (element, env) => resolveStyle(rules, tokens, element, [], env);
const hex = (v) => values.toHex(v);

describe('cascade: specificity', () => {
  it('(id ok) beats (type button) (variant filled), which beats (type button)', () => {
    const ok = resolve(node('button', 'ok', { variant: 'filled' }));
    expect(hex(ok.style.background)).toBe('#333333');
    expect(ok.sources.background).toBe('ok-button');
    expect(hex(ok.style.color)).toBe('#222222');
    expect(ok.sources.color).toBe('filled-button');

    const filled = resolve(node('button', 'other', { variant: 'filled' }));
    expect(hex(filled.style.background)).toBe('#222222');
    expect(filled.sources.background).toBe('filled-button');

    const plain = resolve(node('button'));
    expect(hex(plain.style.background)).toBe('#111111');
    expect(plain.sources.background).toBe('any-button');
  });

  it('does not depend on the source order of rules of different specificity', () => {
    const reversed = [...rules]
      .reverse()
      .map((rule, order) => ({ ...rule, order }));
    const { style } = resolveStyle(
      reversed,
      tokens,
      node('button', 'ok', { variant: 'filled' })
    );
    expect(hex(style.background)).toBe('#333333');
    expect(hex(style.color)).toBe('#222222');
  });
});

describe('cascade: equal specificity', () => {
  it('lets the later rule win', () => {
    const { style, sources } = resolve(node('button'));
    expect(style.radius).toEqual({ type: 'dimension', value: 2, unit: 'px' });
    expect(sources.radius).toBe('late-button');
    expect(style.opacity).toEqual({ type: 'number', value: 0.1 });
  });

  it('lets a later declaration of the same rule win', () => {
    const twice = readStyles(
      '(r: style\n  (selector (type x))\n  (opacity 0.1)\n  (opacity 0.2))'
    ).rules;
    expect(resolveStyle(twice, tokens, node('x')).style.opacity.value).toBe(
      0.2
    );
  });

  it('lets a later media block win, as media adds no specificity', () => {
    expect(
      resolve(node('button'), { viewport: { width: 600 } }).style.opacity.value
    ).toBe(0.6);
    expect(
      resolve(node('button'), { viewport: { width: 599 } }).style.opacity.value
    ).toBe(0.1);
  });
});

describe('cascade: states', () => {
  it('adds specificity, so a state beats a later media block', () => {
    const { style, sources } = resolve(node('button'), {
      states: ['hover'],
      viewport: { width: 600 },
    });
    expect(style.opacity.value).toBe(0.5);
    expect(sources.opacity).toBe('late-button');
  });

  it('loses to an id', () => {
    const { rules: idRules } = readStyles(`(hover: style
  (selector (type x))
  (state hover (opacity 0.5)))
(id: style
  (selector (id one))
  (opacity 0.9))`);
    const { style } = resolveStyle(idRules, tokens, node('x', 'one'), [], {
      states: ['hover'],
    });
    expect(style.opacity.value).toBe(0.9);
  });
});
