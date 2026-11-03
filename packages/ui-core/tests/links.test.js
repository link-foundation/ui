/**
 * `parseLinks` and `formatLinks`: raw Links Notation values without the
 * element projection, read and written by `links-notation`.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  formatLinks,
  parseLinks,
  UiParseError,
} from '@link-foundation/ui-core';

describe('parseLinks / formatLinks', () => {
  it('reads links as raw values', () => {
    const text =
      "(tx 4 (origin devmode) (label 'Edit label') (setProp ok label 'Cancel'))\n";
    expect(parseLinks(text)).toEqual([
      [
        'tx',
        '4',
        ['origin', 'devmode'],
        ['label', 'Edit label'],
        ['setProp', 'ok', 'label', 'Cancel'],
      ],
    ]);
  });

  it('round-trips atoms, quoting, ids and nesting', () => {
    const values = [
      'lonely',
      ['a', '', 'x y', "it's", `say "hi" it's`],
      ['b', { id: 'ok', values: ['button', ['label', 'OK']] }, ['c', ['d']]],
      ['single'],
    ];
    const inline = formatLinks(values, { style: 'inline' });
    expect(inline.split('\n').length).toBe(values.length + 1);
    expect(parseLinks(inline)).toEqual(values);
    const nested = formatLinks(values);
    expect(nested).toBe(
      [
        '(lonely:)',
        'a ~1{} \'x y\' "it\'s" `say "hi" it\'s`',
        'b',
        '  ok: button',
        '    label OK',
        '  c',
        '    d',
        'single',
        '',
      ].join('\n')
    );
    expect(parseLinks(nested)).toEqual(values);
  });

  it('reads the nested form and the one-line form as the same values', () => {
    const nested =
      'tx 4\n  origin devmode\n  setProp ok label\n    text Cancel\n';
    expect(parseLinks(nested)).toEqual(
      parseLinks('(tx 4 (origin devmode) (setProp ok label (text Cancel)))')
    );
  });

  it('round-trips generated values in every style', () => {
    // A small deterministic generator: quoting, ids, newlines, nesting.
    let seed = 133;
    const next = (n) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const refs = ['a', 'b c', "it's", 'x:y', '(p)', 'say "hi"', 'l\nm', '1'];
    const value = (depth) => {
      if (depth > 3 || next(3) === 0) {
        return refs[next(refs.length)];
      }
      const values = Array.from({ length: 1 + next(4) }, () =>
        value(depth + 1)
      );
      return next(2) === 0 ? values : { id: refs[next(refs.length)], values };
    };
    for (let i = 0; i < 300; i += 1) {
      const values = Array.from({ length: 1 + next(3) }, () => value(0));
      for (const style of ['indented', 'multiline', 'inline']) {
        expect(parseLinks(formatLinks(values, { style }))).toEqual(values);
      }
    }
  });

  it('rejects an unknown style', () => {
    expect(() => formatLinks([], { style: 'yaml' })).toThrow(TypeError);
  });

  it('writes nothing for no values', () => {
    expect(formatLinks([])).toBe('');
    expect(parseLinks('')).toEqual([]);
  });

  it('throws UiParseError with a diagnostic on bad input', () => {
    const codeOf = (input, options) => {
      try {
        parseLinks(input, options);
      } catch (error) {
        expect(error instanceof UiParseError).toBe(true);
        return error.diagnostics[0].code;
      }
      return null;
    };
    expect(codeOf('(a b')).toBe('syntax-error');
    expect(codeOf(42)).toBe('syntax-error');
    expect(codeOf('(a b)', { maxInputSize: 2 })).toBe('input-too-large');
  });
});
