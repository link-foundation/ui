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
    const text = formatLinks(values);
    expect(text.split('\n').length).toBe(values.length + 1);
    expect(parseLinks(text)).toEqual(values);
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
