/**
 * The LiNo match / replace rule engine (src/rules.js).
 */

import { describe, it, expect } from 'test-anywhere';
import {
  applyRules,
  importJsx,
  loadMappings,
  matchTerm,
  readRules,
  substitute,
} from '@link-foundation/ui-convert';

const rules = (text) => readRules(text);

describe('readRules', () => {
  it('reads named rules with match and replace', () => {
    expect(rules('(r: rule (match (A (x $v))) (replace (a (y $v))))')).toEqual([
      { name: 'r', match: ['A', ['x', '$v']], replace: ['a', ['y', '$v']] },
    ]);
  });

  it('reads rules written over several lines', () => {
    const text = '(r: rule\n  (match (A))\n  (replace (a)))\n';
    expect(rules(text).map((r) => r.name)).toEqual(['r']);
  });

  it('skips links that are not rules', () => {
    expect(
      rules(
        '(m: mapping (description x))\n(r: rule (match (A)) (replace (a)))'
      ).map((r) => r.name)
    ).toEqual(['r']);
  });
});

describe('applyRules', () => {
  it('binds $var and substitutes it', () => {
    const table = rules(
      '(r: rule (match (Button (children $label))) (replace (button (label $label))))'
    );
    expect(applyRules(['Button', ['children', 'OK']], table)).toEqual({
      node: ['button', ['label', 'OK']],
      applied: ['r'],
      consumed: [['children', 'OK']],
      rest: [],
    });
  });

  it('substitutes $var inside an atom: space.$n', () => {
    const table = rules(
      '(r: rule (match (Stack (spacing $n))) (replace (stack (gap (token space.$n)))))'
    );
    expect(applyRules(['Stack', ['spacing', '2']], table).node).toEqual([
      'stack',
      ['gap', ['token', 'space.2']],
    ]);
  });

  it('leaves an element unchanged when no rule matches', () => {
    const table = rules(
      '(r: rule (match (Button (variant contained))) (replace (button)))'
    );
    const element = ['Button', ['variant', 'outlined']];
    expect(applyRules(element, table)).toEqual({
      node: element,
      applied: [],
      consumed: [],
      rest: [['variant', 'outlined']],
    });
  });

  it('applies the first matching rule only', () => {
    const table = rules(
      [
        '(first: rule (match (Button (variant text))) (replace (button (variant text))))',
        '(second: rule (match (Button)) (replace (button)))',
      ].join('\n')
    );
    expect(applyRules(['Button', ['variant', 'text']], table).applied).toEqual([
      'first',
    ]);
    expect(applyRules(['Button', ['variant', 'x']], table)).toEqual({
      node: ['button'],
      applied: ['second'],
      consumed: [],
      rest: [['variant', 'x']],
    });
  });

  it('keeps unmatched properties in rest', () => {
    const table = rules('(r: rule (match (Box)) (replace (box)))');
    expect(applyRules(['Box', ['id', 'a']], table).rest).toEqual([['id', 'a']]);
  });

  it('supports optional properties: an unbound $var drops its property', () => {
    const table = rules(
      '(r: rule (match (Switch (optional (checked $c)))) (replace (switch (checked $c))))'
    );
    expect(applyRules(['Switch'], table).node).toEqual(['switch']);
    expect(applyRules(['Switch', ['checked', 'true']], table).node).toEqual([
      'switch',
      ['checked', 'true'],
    ]);
  });

  it('supports absent properties', () => {
    const table = rules(
      '(r: rule (match (Card (absent variant))) (replace (card)))'
    );
    expect(applyRules(['Card'], table).applied).toEqual(['r']);
    expect(applyRules(['Card', ['variant', 'x']], table).applied).toEqual([]);
  });

  it('needs a repeated $var to bind the same term', () => {
    const bindings = matchTerm(['a', '$x', '$x'], ['a', '1', '2']);
    expect(bindings).toBe(null);
    expect(matchTerm(['a', '$x', '$x'], ['a', '1', '1']).get('$x')).toBe('1');
  });

  it('matches _ against any term without binding', () => {
    expect(matchTerm(['a', '_'], ['a', ['b', 'c']]).size).toBe(0);
  });

  it('substitute fills $var and gives undefined when one is unbound', () => {
    const bindings = new Map([['$x', '1']]);
    expect(substitute(['b', '$x', 'space.$x'], bindings)).toEqual([
      'b',
      '1',
      'space.1',
    ]);
    expect(substitute(['b', '$y'], bindings)).toBe(undefined);
  });
});

describe('mappings option', () => {
  it('reads rule text given in options.mappings, before mui', () => {
    const own =
      '(my-button: rule (match (Button (children $l))) (replace (button (label $l) (variant tonal))))';
    expect(loadMappings([own, 'mui'])[0].name).toBe('my-button');
    const { text, applied } = importJsx('<Button>Go</Button>', {
      mappings: [own, 'mui'],
    });
    expect(text).toContain('\n  variant tonal\n');
    expect([...applied.values()]).toEqual(['my-button']);
  });

  it('gives (html (tag X)) with no mappings', () => {
    expect(importJsx('<Button>Go</Button>', { mappings: [] }).text).toContain(
      'button-0: html\n  tag Button\n'
    );
  });
});
