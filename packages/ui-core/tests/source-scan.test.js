/**
 * `scanDelimiters` finds the delimiters of a comment-stripped text without
 * regular expressions; `quotedEnd` follows the quoting rule of the grammar.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'test-anywhere';
import { stripComments } from 'links-notation';
import { quotedEnd, scanDelimiters } from '@link-foundation/ui-core/source';
import { REPO } from './helpers.js';

const kinds = (text) =>
  scanDelimiters(text).tokens.map(
    (t) =>
      `${t.type}:${t.type === 'break' ? t.indent : text.slice(t.start, t.end)}`
  );

describe('scanDelimiters', () => {
  it('finds parentheses, colons, references and line breaks', () => {
    expect(kinds('(ok: button\n  (label OK))')).toEqual([
      'open:(',
      'reference:ok',
      'colon::',
      'reference:button',
      'break:2',
      'open:(',
      'reference:label',
      'reference:OK',
      'close:)',
      'close:)',
    ]);
  });

  it('reads a quoted reference as one token, delimiters and all', () => {
    const text = "(a: text 'it''s (a) # b: c')";
    const references = scanDelimiters(text).tokens.filter(
      (t) => t.type === 'reference'
    );
    expect(references.map((t) => text.slice(t.start, t.end))).toEqual([
      'a',
      'text',
      "'it''s (a) # b: c'",
    ]);
    expect(references.map((t) => t.quoted)).toEqual([false, false, true]);
  });

  it('records the start and indentation of every line', () => {
    const text = 'a\n  b\r\n    c\n';
    const { lineStarts, indents } = scanDelimiters(text);
    expect(lineStarts).toEqual([0, 2, 7, 13]);
    expect(indents).toEqual([0, 2, 4, 0]);
  });

  it('keeps the offsets of the text it was given after stripComments', () => {
    const text = "(ok: button # a comment\n  (label 'OK'))";
    const stripped = stripComments(text);
    expect(stripped.length).toBe(text.length);
    for (const t of scanDelimiters(stripped).tokens) {
      expect(text.slice(t.start, t.end)).toBe(stripped.slice(t.start, t.end));
    }
  });
});

describe('quotedEnd', () => {
  it('closes a single, double or backtick quote', () => {
    expect(quotedEnd("'ab' c", 0)).toBe(4);
    expect(quotedEnd('"ab" c', 0)).toBe(4);
    expect(quotedEnd('`ab` c', 0)).toBe(4);
  });

  it('reads a doubled delimiter as an escaped one', () => {
    expect(quotedEnd("'it''s' x", 0)).toBe(7);
  });

  it('reads an even run with nothing substantive as the empty reference', () => {
    expect(quotedEnd("'' x", 0)).toBe(2);
  });

  it('returns null where no quote opens', () => {
    expect(quotedEnd('abc', 0)).toBeNull();
  });
});

describe('the source module', () => {
  it('uses no regular expressions', () => {
    // The check of the issue:
    // grep -rn "RegExp\|\.match(\|/.*/[gimsuy]*\.test(" src/source
    const dir = join(REPO, 'packages', 'ui-core', 'src', 'source');
    const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
    expect(files).toContain('scan.js');
    for (const file of files) {
      const lines = readFileSync(join(dir, file), 'utf8').split('\n');
      for (const line of lines) {
        const hit =
          line.includes('RegExp') ||
          line.includes('.match(') ||
          /\/.*\/[gimsuy]*\.test\(/.test(line);
        expect(hit, `${file}: ${line}`).toBe(false);
      }
    }
  });
});
