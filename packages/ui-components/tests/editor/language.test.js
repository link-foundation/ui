import { URL } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { validateLino } from '../../src/editor/validate-lino.js';
import {
  highlightLino,
  highlightLinoLine,
} from '../../src/editor/lino-highlight.js';
import { linoStructure } from '../../src/editor/lino-structure.js';

const samples = new URL(
  '../../../../docs/case-studies/issue-1/samples/',
  import.meta.url
);
describe('LiNo editor language', () => {
  for (const name of readdirSync(samples).filter((n) => n.endsWith('.lino'))) {
    it(`validates ${name} with the official parser`, () => {
      assert.deepEqual(
        validateLino(readFileSync(new URL(name, samples), 'utf8')),
        { ok: true, diagnostics: [] }
      );
    });
  }
  it('pins the official unclosed-link diagnostic at end of input', () => {
    const source = "(app: document\n  (title 'Links UI demo')\n";
    const result = validateLino(source);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0].line, 3);
    assert.equal(result.diagnostics[0].column, 1);
    assert.equal(
      result.diagnostics[0].message,
      'Syntax error at line 3, column 1: Expected " ", "(", ")", [ \\t\\n\\r], [ \\t], [\\r\\n], or [^ \\t\\n\\r(:)] but end of input found.\n3 | \n  | ^'
    );
  });
  it('colours ids, references, strings, comments and delimiters without parsing links', () => {
    const text = "(theme: color '#6750A4') # note\nref#word";
    const tokens = highlightLino(text).map((t) => [
      t.type,
      text.slice(t.from, t.to),
    ]);
    assert.deepEqual(tokens, [
      ['paren', '('],
      ['id', 'theme'],
      ['colon', ':'],
      ['word', 'color'],
      ['string', "'#6750A4'"],
      ['paren', ')'],
      ['comment', '# note'],
      ['word', 'ref#word'],
    ]);
  });
  it('keeps quote runs, escaped quotes and multiline strings together', () => {
    const text = "'''a 'b'\n(c)''' 'it''s'";
    assert.deepEqual(
      highlightLino(text).map((t) => text.slice(t.from, t.to)),
      ["'''a 'b'\n(c)'''", "'it''s'"]
    );
  });
  it('keeps adjacent empty quoted references separate', () => {
    assert.deepEqual(
      highlightLino("'' ''").map((t) => [t.from, t.to]),
      [
        [0, 2],
        [3, 5],
      ]
    );
  });
  it('carries only a quote delimiter across Monaco lines', () => {
    const first = highlightLinoLine("a '''start");
    assert.equal(first.continuation, "'''");
    const second = highlightLinoLine('# (still quoted)', first.continuation);
    assert.equal(second.tokens[0].type, 'string');
    const third = highlightLinoLine("end''' # note", second.continuation);
    assert.equal(third.continuation, '');
    assert.deepEqual(
      third.tokens.map((t) => t.type),
      ['string', 'comment']
    );
  });
  it('folds parenthesized and indented links only when the parser accepts them', () => {
    assert.deepEqual(linoStructure('(a\n  (b c))').pairs, [
      { from: 5, to: 10 },
      { from: 0, to: 11 },
    ]);
    const nested =
      'app: document\n  title Demo\n  body: stack\n    text Hello\nother: text Bye';
    assert.equal(linoStructure(nested).folds.length, 2);
    assert.deepEqual(linoStructure('(a\n').folds, []);
    assert.deepEqual(linoStructure("a '(ignore)' # (comment)\n").pairs, []);
  });
});
