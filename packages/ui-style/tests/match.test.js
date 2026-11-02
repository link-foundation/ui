/**
 * `matches`, `specificity` and `flatten`: selector matching and the cascade
 * order shared by `resolveStyle` and `compileCss`.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  compareSpecificity,
  flatten,
  matches,
  readStyles,
  specificity,
} from '@link-foundation/ui-style';
import { node, sampleDocument, sampleStyles } from './helpers.js';

const sel = (parts = {}) => ({
  type: null,
  id: null,
  props: [],
  within: [],
  ...parts,
});

describe('matches', () => {
  const ok = node('button', 'ok', { variant: 'filled' });

  it('matches type, id and properties', () => {
    expect(matches(sel({ type: 'button' }), ok)).toBe(true);
    expect(matches(sel({ type: 'text' }), ok)).toBe(false);
    expect(matches(sel({ id: 'ok' }), ok)).toBe(true);
    expect(matches(sel({ id: 'cancel' }), ok)).toBe(false);
    expect(
      matches(sel({ props: [{ name: 'variant', value: 'filled' }] }), ok)
    ).toBe(true);
    expect(
      matches(sel({ props: [{ name: 'variant', value: 'outlined' }] }), ok)
    ).toBe(false);
    expect(matches(sel({ props: [{ name: 'label', value: 'x' }] }), ok)).toBe(
      false
    );
    expect(matches(sel(), ok)).toBe(true);
  });

  it('matches the ok button of the sample document', () => {
    const { ok: button, okAncestors } = sampleDocument();
    const [rule] = sampleStyles().rules;
    expect(matches(rule.selector, button, okAncestors)).toBe(true);
    expect(
      matches(
        sel({ type: 'button', within: [sel({ type: 'stack' })] }),
        button,
        okAncestors
      )
    ).toBe(true);
    expect(
      matches(
        sel({ type: 'button', within: [sel({ type: 'dialog' })] }),
        button,
        okAncestors
      )
    ).toBe(false);
  });

  it('matches within against any ancestor, nested from the root', () => {
    const dialog = node('dialog');
    const list = node('list');
    const chip = node('chip');
    const nested = sel({
      type: 'chip',
      within: [sel({ type: 'list', within: [sel({ type: 'dialog' })] })],
    });
    expect(matches(nested, chip, [dialog, list])).toBe(true);
    expect(matches(nested, chip, [list, dialog])).toBe(false);
    expect(matches(nested, chip, [list])).toBe(false);
    const both = sel({
      type: 'chip',
      within: [sel({ type: 'list' }), sel({ type: 'dialog' })],
    });
    expect(matches(both, chip, [list, dialog])).toBe(true);
    expect(matches(both, chip, [dialog])).toBe(false);
  });
});

describe('specificity', () => {
  it('counts ids, properties and states, and types', () => {
    expect(specificity(sel({ id: 'ok' }))).toEqual([1, 0, 0]);
    expect(
      specificity(
        sel({ type: 'button', props: [{ name: 'variant', value: 'filled' }] })
      )
    ).toEqual([0, 1, 1]);
    expect(specificity(sel({ type: 'button' }), 2)).toEqual([0, 2, 1]);
    expect(
      specificity(
        sel({ type: 'chip', within: [sel({ id: 'd', type: 'dialog' })] })
      )
    ).toEqual([1, 0, 2]);
  });

  it('compares tuples from the left', () => {
    expect(compareSpecificity([1, 0, 0], [0, 9, 9]) > 0).toBe(true);
    expect(compareSpecificity([0, 1, 0], [0, 0, 9]) > 0).toBe(true);
    expect(compareSpecificity([0, 1, 1], [0, 1, 2]) < 0).toBe(true);
    expect(compareSpecificity([0, 1, 1], [0, 1, 1])).toBe(0);
  });
});

describe('flatten', () => {
  it('gives rules in order, own declarations before blocks, depth-first', () => {
    const { rules } = readStyles(`(a: style
  (selector (type x))
  (opacity 1)
  (media (max-width 10px)
    (opacity 0.5)
    (state hover (opacity 0.6)))
  (state focus (opacity 0.7)))
(b: style
  (selector (type y))
  (opacity 0.8))`);
    const entries = flatten(rules);
    expect(
      entries.map((e) => [
        e.id,
        e.index,
        e.states,
        e.at.map((a) => a.kind),
        e.declarations[0].value.value,
      ])
    ).toEqual([
      ['a', 0, [], [], 1],
      ['a', 1, [], ['media'], 0.5],
      ['a', 2, ['hover'], ['media'], 0.6],
      ['a', 3, ['focus'], [], 0.7],
      ['b', 4, [], [], 0.8],
    ]);
  });
});
