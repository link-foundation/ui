/**
 * Diagnostics (docs/spec/limits.md): parse never throws; every problem is a
 * `{ code, severity, message, at }` entry of `doc.diagnostics`.
 */

import { describe, it, expect } from 'test-anywhere';
import { Parser } from 'links-notation';
import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_INPUT_SIZE,
  parse,
  parseOrThrow,
  UiParseError,
} from '@link-foundation/ui-core';
import { seededRandom } from './helpers.js';

const codes = (doc) => doc.diagnostics.map((d) => d.code);

/** The ParseError links-notation throws for `text`. */
function parserError(text, options) {
  try {
    new Parser(options).parse(text);
  } catch (error) {
    return error;
  }
  throw new Error('expected a parse error');
}

describe('syntax errors', () => {
  it('reports an unclosed ( with its line and column', () => {
    const text = "(app: document\n  (title 'Demo')\n  (body: stack\n";
    const doc = parse(text);
    expect(doc.diagnostics.length).toBe(1);
    const [error] = doc.diagnostics;
    expect(error.code).toBe('syntax-error');
    expect(error.severity).toBe('error');
    expect(error.at).toEqual({ line: 4, column: 1 });
    const thrown = parserError(text);
    expect(error.at).toEqual({ line: thrown.line, column: thrown.column });
    expect(error.message).toContain('line 4, column 1');
    expect(doc.roots).toEqual([]);
    expect(doc.byId.size).toBe(0);
  });

  it('reports an unclosed ( on one line', () => {
    expect(parse('(ok: button').diagnostics[0].at).toEqual({
      line: 1,
      column: 12,
    });
  });

  it('reports a stray ) and an unquoted value with a colon', () => {
    expect(codes(parse('(a: text x))'))).toEqual(['syntax-error']);
    expect(codes(parse('(a: link (href http://x))'))).toEqual(['syntax-error']);
  });
});

describe('limits', () => {
  it('uses the spec defaults', () => {
    expect(DEFAULT_MAX_DEPTH).toBe(64);
    expect(DEFAULT_MAX_INPUT_SIZE).toBe(1024 * 1024);
  });

  it('reports input nested deeper than maxDepth as an error, not a crash', () => {
    const deep = `${'('.repeat(70)}x${')'.repeat(70)}`;
    const doc = parse(deep);
    expect(codes(doc)).toEqual(['depth-exceeded']);
    expect(doc.diagnostics[0].severity).toBe('error');
    expect(doc.diagnostics[0].at).toEqual({ line: 1, column: 65 });
    expect(codes(parse(deep, { maxDepth: 100 }))).toEqual(['unknown-sublink']);
    expect(
      codes(parse('(a: stack (b: stack (c: text x)))', { maxDepth: 2 }))
    ).toEqual(['depth-exceeded']);
  });

  it('reports indentation deeper than maxDepth', () => {
    const lines = Array.from(
      { length: 70 },
      (_, i) => `${'  '.repeat(i)}e${i}: stack`
    );
    expect(codes(parse(lines.join('\n')))).toEqual(['depth-exceeded']);
  });

  it('turns a stack overflow under a huge maxDepth into a diagnostic', () => {
    const n = 5000;
    const text = `${'(a: stack '.repeat(n)}x${')'.repeat(n)}`;
    const doc = parse(text, { maxDepth: Infinity });
    expect(doc.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    expect(codes(doc)).toEqual(['depth-exceeded']);
  });

  it('refuses input larger than maxInputSize before parsing', () => {
    const doc = parse('(a: text x)', { maxInputSize: 5 });
    expect(
      doc.diagnostics.map(({ code, severity, at }) => ({ code, severity, at }))
    ).toEqual([{ code: 'input-too-large', severity: 'error', at: {} }]);
    expect(doc.roots).toEqual([]);
  });

  it('reports a non-string input without throwing', () => {
    expect(codes(parse(undefined))).toEqual(['syntax-error']);
    expect(codes(parse(42))).toEqual(['syntax-error']);
  });
});

describe('ids and properties', () => {
  it('reports a duplicate ok: as duplicate-id and keeps the first in byId', () => {
    const doc = parse(
      '(app: document (ok: button (label A)) (ok: button (label B)))'
    );
    expect(codes(doc)).toEqual(['duplicate-id']);
    expect(doc.diagnostics[0]).toEqual({
      code: 'duplicate-id',
      severity: 'error',
      message: 'The id "ok" is used more than once',
      at: { element: 'ok' },
    });
    expect(doc.byId.get('ok').properties).toEqual([
      { name: 'label', values: ['A'] },
    ]);
    expect(doc.roots[0].children.length).toBe(2);
  });

  it('reports a duplicate single-valued property; the last one wins', () => {
    const doc = parse('(ok: button (label A) (label B))');
    expect(doc.diagnostics.map((d) => [d.code, d.severity, d.at])).toEqual([
      ['duplicate-property', 'warning', { element: 'ok', property: 'label' }],
    ]);
    expect(doc.roots[0].properties).toEqual([{ name: 'label', values: ['B'] }]);
  });

  it('keeps every value of a multi-valued property without a warning', () => {
    const doc = parse(
      '(ok: button (on press (navigate a)) (on hover (navigate b)))'
    );
    expect(doc.diagnostics).toEqual([]);
    expect(doc.roots[0].properties.length).toBe(2);
  });
});

describe('unknown sublinks', () => {
  it('keeps (colour red) under a button with the warning unknown-sublink', () => {
    const doc = parse("(ok: button 'OK' (colour red))");
    expect(doc.diagnostics.map((d) => [d.code, d.severity, d.at])).toEqual([
      ['unknown-sublink', 'warning', { element: 'ok', head: 'colour' }],
    ]);
    expect(doc.roots[0].unknown).toEqual([['colour', 'red']]);
    expect(doc.roots[0].positional).toEqual(['OK']);
  });

  it('keeps an unknown top-level link in doc.unknown', () => {
    const doc = parse('(hello world)');
    expect(doc.roots).toEqual([]);
    expect(doc.unknown).toEqual([['hello', 'world']]);
    expect(doc.diagnostics[0].at).toEqual({ element: null, head: 'hello' });
  });

  it('keeps a path that cannot be folded verbatim with head null', () => {
    const doc = parse('(card: stack ((x y) z))');
    expect(doc.roots[0].unknown).toEqual([[['x', 'y'], 'z']]);
    expect(doc.diagnostics.map((d) => d.at)).toEqual([
      { element: 'card', head: null },
    ]);
  });

  it('warns about an unknown kind and a missing kind', () => {
    expect(codes(parse('(c: chart)'))).toEqual(['unknown-kind']);
    const doc = parse('(c: (x) y)');
    expect(codes(doc)).toEqual(['missing-kind']);
    expect(doc.roots[0]).toEqual({
      id: 'c',
      kind: null,
      positional: ['y'],
      properties: [],
      children: [],
      unknown: [['x']],
    });
  });

  it('warns about a child of a kind without children', () => {
    expect(codes(parse('(t: text Hi (b: button OK))'))).toEqual([
      'unexpected-child',
    ]);
  });
});

describe('parse never throws', () => {
  const ALPHABET = [
    '(',
    ')',
    ':',
    "'",
    ' ',
    ' ',
    '\n',
    'a',
    'b',
    'k',
    'x',
    'z',
  ];
  const random = seededRandom(14);
  const inputs = Array.from({ length: 200 }, () => {
    const length = Math.floor(random() * 80);
    let text = '';
    for (let i = 0; i < length; i++) {
      text += ALPHABET[Math.floor(random() * ALPHABET.length)];
    }
    return text;
  });

  it('on 200 seeded random inputs', () => {
    let failures = 0;
    for (const text of inputs) {
      const doc = parse(text);
      expect(Array.isArray(doc.roots)).toBe(true);
      for (const d of doc.diagnostics) {
        expect(typeof d.code).toBe('string');
        expect(typeof d.message).toBe('string');
      }
      if (doc.diagnostics.some((d) => d.code === 'syntax-error')) {
        failures++;
      }
    }
    // Both valid and invalid inputs are exercised.
    expect(failures).toBeGreaterThan(0);
    expect(failures).toBeLessThan(inputs.length);
  });

  it('on the same inputs in fold mode', () => {
    for (const text of inputs) {
      expect(Array.isArray(parse(text, { mode: 'fold' }).diagnostics)).toBe(
        true
      );
    }
  });
});

describe('parseOrThrow', () => {
  it('returns the document when there is no error', () => {
    const doc = parseOrThrow("(ok: button 'OK' (colour red))");
    expect(codes(doc)).toEqual(['unknown-sublink']);
  });

  it('throws a UiParseError that carries the errors', () => {
    let thrown;
    try {
      parseOrThrow('(ok: button');
    } catch (error) {
      thrown = error;
    }
    expect(thrown instanceof UiParseError).toBe(true);
    expect(thrown.diagnostics.map((d) => d.code)).toEqual(['syntax-error']);
    expect(thrown.message).toContain('syntax-error');
  });
});
