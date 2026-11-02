/**
 * `readStyles(text)`: the rule grammar, CSS syntax in bare values and the
 * diagnostics.
 */

import { describe, it, expect } from 'test-anywhere';
import { readStyles } from '@link-foundation/ui-style';
import { codes, fixtureStyles, sampleStyles } from './helpers.js';

const ref = (path) => ({ type: 'token-ref', path });

describe('readStyles: the issue-1 sample', () => {
  it('gives one rule with 3 declarations and 2 state blocks', () => {
    const { rules, diagnostics } = sampleStyles();
    expect(diagnostics).toEqual([]);
    expect(rules.length).toBe(1);
    const [rule] = rules;
    expect(rule.id).toBe('button-style');
    expect(rule.order).toBe(0);
    expect(rule.selector).toEqual({
      type: 'button',
      id: null,
      props: [{ name: 'variant', value: 'filled' }],
      within: [],
    });
    expect(rule.declarations).toEqual([
      { property: 'background', value: ref('color.primary') },
      { property: 'color', value: ref('color.on-primary') },
      { property: 'radius', value: ref('shape.corner.medium') },
    ]);
    expect(rule.blocks.length).toBe(2);
    expect(rule.blocks.map((b) => [b.kind, b.condition])).toEqual([
      ['state', 'hover'],
      ['state', 'pressed'],
    ]);
    expect(rule.blocks[0].rule.declarations).toEqual([
      { property: 'elevation', value: { type: 'number', value: 2 } },
    ]);
    expect(rule.blocks[1].rule.declarations).toEqual([
      { property: 'scale', value: { type: 'number', value: 0.98 } },
    ]);
  });

  it('reads the one-line form the same way', () => {
    const { rules } = readStyles(
      '(button-style: style (selector (type button) (variant filled)) (background (token color.primary)) (color (token color.on-primary)) (radius (token shape.corner.medium)) (state hover (elevation 2)) (state pressed (scale 0.98)))'
    );
    expect(rules).toEqual(sampleStyles().rules);
  });
});

describe('readStyles: CSS syntax is a diagnostic, never accepted', () => {
  it('reports (state :hover ...) and drops the block', () => {
    const { rules, diagnostics } = readStyles(
      '(b: style (selector (type button)) (state :hover (elevation 2)))'
    );
    expect(codes(diagnostics)).toEqual(['css-syntax']);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].at.rule).toBe('b');
    expect(rules[0].blocks).toEqual([]);
  });

  it('reports a quoted value with :hover', () => {
    const { rules, diagnostics } = readStyles(
      "(b: style (selector (type 'button:hover')) (background '#FFFFFF'))\n(c: style (selector (type x)) (state 'hover:focus' (opacity 1)))"
    );
    expect(codes(diagnostics)).toEqual([
      'css-syntax',
      'missing-selector',
      'css-syntax',
    ]);
    expect(diagnostics[0].at.text).toBe('button:hover');
    expect(rules.map((r) => r.id)).toEqual(['c']);
    expect(rules[0].blocks).toEqual([]);
  });

  it('reports (media (max-width: 640px)), never read as the id max-width', () => {
    const { rules, diagnostics } = readStyles(
      '(b: style (selector (type button)) (media (max-width: 640px) (padding 1px)))'
    );
    expect(codes(diagnostics)).toEqual(['css-syntax']);
    expect(diagnostics[0].at.text).toBe('max-width:');
    expect(rules[0].blocks).toEqual([]);
  });

  it('keeps the syntax error of a bare red:hover', () => {
    const { rules, diagnostics } = readStyles(
      '(b: style (selector (type button)) (background red:hover))'
    );
    expect(codes(diagnostics)).toEqual(['syntax-error']);
    expect(rules).toEqual([]);
  });
});

describe('readStyles: the grammar of the issue', () => {
  it('reads within, media, container, nested state and several conditions', () => {
    const { rules, diagnostics } = fixtureStyles('card.lino');
    expect(diagnostics).toEqual([]);
    const [card, chip] = rules;
    expect(card.selector).toEqual({
      type: 'card',
      id: null,
      props: [],
      within: [{ type: 'dialog', id: null, props: [], within: [] }],
    });
    expect(card.declarations).toEqual([
      { property: 'padding', value: ref('space.medium') },
    ]);
    expect(card.blocks.map((b) => b.kind)).toEqual([
      'media',
      'container',
      'media',
      'state',
    ]);
    const [media, container, dark] = card.blocks;
    expect(media.condition).toEqual([
      {
        feature: 'max-width',
        value: { type: 'dimension', value: 640, unit: 'px' },
      },
    ]);
    expect(media.rule.declarations).toEqual([
      { property: 'padding', value: ref('space.small') },
    ]);
    expect(media.rule.blocks[0].kind).toBe('state');
    expect(media.rule.blocks[0].condition).toBe('hover');
    expect(media.rule.blocks[0].rule.selector).toBe(card.selector);
    expect(container.condition[0].feature).toBe('min-width');
    expect(container.rule.declarations).toEqual([
      { property: 'direction', value: { type: 'enum', value: 'horizontal' } },
    ]);
    expect(dark.condition.map((c) => [c.feature, c.value.value])).toEqual([
      ['prefers-color-scheme', 'dark'],
      ['prefers-reduced-motion', 'reduce'],
    ]);
    expect(chip.order).toBe(1);
    expect(chip.selector.id).toBe('chip 1');
    expect(chip.selector.props).toEqual([{ name: 'label', value: "it's" }]);
    expect(chip.selector.within.map((w) => w.type)).toEqual(['list', 'dialog']);
    expect(chip.declarations[0].value.type).toBe('list');
  });

  it('reads every property of the vocabulary', () => {
    const { rules, diagnostics } = readStyles(`(all: style
  (selector (type x))
  (background '#FFFFFF')
  (color (oklch 0.5 0.1 300))
  (radius 4px)
  (padding 1px 2px 3px 4px)
  (gap 2px)
  (opacity 0.5)
  (elevation 3)
  (scale 1.02)
  (font-size 1rem)
  (font-weight 700)
  (border-width 0)
  (border-color (token c))
  (direction vertical))`);
    expect(diagnostics).toEqual([]);
    expect(rules[0].declarations.map((d) => d.property)).toEqual([
      'background',
      'color',
      'radius',
      'padding',
      'gap',
      'opacity',
      'elevation',
      'scale',
      'font-size',
      'font-weight',
      'border-width',
      'border-color',
      'direction',
    ]);
  });

  it('skips elements that are not style rules', () => {
    const { rules, diagnostics } = readStyles(
      '(t: theme (token a 1px))\n(s: style (selector (type x)) (opacity 1))'
    );
    expect(diagnostics).toEqual([]);
    expect(rules.map((r) => [r.id, r.order])).toEqual([['s', 0]]);
  });
});

describe('readStyles: diagnostics', () => {
  const one = (body) =>
    readStyles(`(r: style (selector (type x)) ${body})`).diagnostics;

  it('reports an unknown property', () => {
    const [d] = one('(shadow 2)');
    expect(d.code).toBe('unknown-property');
    expect(d.at).toEqual({ rule: 'r', property: 'shadow' });
  });

  it('reports invalid values and never accepts url(', () => {
    expect(codes(one("(background 'url(evil)')"))).toEqual(['invalid-value']);
    expect(codes(one('(background 16px)'))).toEqual(['invalid-value']);
    expect(codes(one('(padding red)'))).toEqual(['invalid-value']);
    expect(codes(one('(opacity 2)'))).toEqual(['invalid-value']);
    expect(codes(one('(elevation 1.5)'))).toEqual(['invalid-value']);
    expect(codes(one('(elevation (token e))'))).toEqual(['invalid-value']);
    expect(codes(one('(direction diagonal)'))).toEqual(['invalid-value']);
    expect(codes(one('(padding 1px 2px 3px 4px 5px)'))).toEqual([
      'invalid-value',
    ]);
    expect(codes(one('(color (param draft.color))'))).toEqual([
      'invalid-value',
    ]);
    expect(codes(one('(radius -1px)'))).toEqual(['invalid-value']);
  });

  it('reports unknown states, invalid conditions and misplaced selectors', () => {
    expect(codes(one('(state active (opacity 1))'))).toEqual(['unknown-state']);
    expect(codes(one('(media (min-height 10px) (opacity 1))'))).toEqual([
      'invalid-condition',
    ]);
    expect(
      codes(one('(media (prefers-color-scheme blue) (opacity 1))'))
    ).toEqual(['invalid-condition']);
    expect(
      codes(one('(container (prefers-color-scheme dark) (opacity 1))'))
    ).toEqual(['invalid-condition']);
    expect(codes(one('(media (opacity 1))'))).toEqual(['invalid-condition']);
    expect(codes(one('(media (max-width 10vw) (opacity 1))'))).toEqual([
      'invalid-condition',
    ]);
    expect(codes(one('(state hover (selector (type y)))'))).toEqual([
      'misplaced-selector',
    ]);
    expect(codes(one('stray'))).toEqual(['unexpected-value']);
  });

  it('reports missing, duplicate and invalid selectors and anonymous rules', () => {
    expect(codes(readStyles('(r: style (opacity 1))').diagnostics)).toEqual([
      'missing-selector',
    ]);
    const twice = readStyles(
      '(r: style (selector (type a)) (selector (type b)) (opacity 1))'
    );
    expect(codes(twice.diagnostics)).toEqual(['duplicate-selector']);
    expect(twice.rules[0].selector.type).toBe('b');
    expect(
      codes(readStyles('(r: style (selector (type a b)))').diagnostics)
    ).toEqual(['invalid-selector', 'missing-selector']);
    expect(
      codes(readStyles('(r: style (selector (type a) (type b)))').diagnostics)
    ).toEqual(['invalid-selector', 'missing-selector']);
    expect(
      codes(readStyles('(r: style (selector (within (x (y)))))').diagnostics)
    ).toEqual(['invalid-selector', 'missing-selector']);
    const anonymous = readStyles('(style (selector (type a)) (opacity 1))');
    expect(codes(anonymous.diagnostics)).toEqual(['anonymous-rule']);
    expect(anonymous.rules[0].id).toBe('style-1');
  });
});
