/**
 * `format(doc)` writes Links Notation that reads back into the same tree:
 * `parse(format(parse(t)))` deep-equals `parse(t)` in all three styles.
 */

import { describe, it, expect } from 'test-anywhere';
import { format, parse } from '@link-foundation/ui-core';
import { samples, shape, sortedDiagnostics, specFixtures } from './helpers.js';

const STYLES = ['inline', 'multiline', 'indented'];

// Diagnostics that describe the text, not the tree: a parser error
// leaves no tree to write back, and only the last of duplicate properties is
// in the tree, so the written text has no duplicate.
const TEXT_ONLY = new Set([
  'syntax-error',
  'depth-exceeded',
  'input-too-large',
  'duplicate-property',
]);
const treeDiagnostics = (doc) =>
  sortedDiagnostics(doc.diagnostics.filter((d) => !TEXT_ONLY.has(d.code)));

const inputs = [
  ...samples().map((s) => ({ ...s, name: `sample ${s.name}` })),
  ...specFixtures().map((f) => ({ ...f, name: `fixture ${f.name}` })),
];

describe('format round trip', () => {
  for (const { name, text } of inputs) {
    for (const style of STYLES) {
      it(`${name} (${style})`, () => {
        const doc = parse(text);
        const again = parse(format(doc, { style }));
        expect(shape(again)).toEqual(shape(doc));
        expect([...again.byId.keys()]).toEqual([...doc.byId.keys()]);
        expect(treeDiagnostics(again)).toEqual(treeDiagnostics(doc));
      });
    }
  }

  it('round-trips quoting, empty strings, top-level atoms and unknown paths', () => {
    const text = [
      "(t: text 'a b' \"it's\" '' (style `say \"hi\" it's`))",
      '(lonely:)',
      '(x: stack ((p q) r) (s: text (unknown (deep (er)))))',
      '(other-root 1 2)',
      '(nameless: (first value) text)',
      '',
    ].join('\n');
    const doc = parse(text);
    expect(doc.unknown).toEqual(['lonely', ['other-root', '1', '2']]);
    for (const style of STYLES) {
      const again = parse(format(doc, { style }));
      expect(shape(again)).toEqual(shape(doc));
      expect(sortedDiagnostics(again.diagnostics)).toEqual(
        sortedDiagnostics(doc.diagnostics)
      );
    }
  });
});

describe('format styles', () => {
  const doc = parse(
    '(ok: button (label OK) (on press (navigate home)) (badge: text 1))'
  );

  it('defaults to multiline', () => {
    expect(format(doc)).toBe(format(doc, { style: 'multiline' }));
    expect(format(doc)).toBe(
      [
        '(ok: button',
        '  (label OK)',
        '  (on press (navigate home))',
        '  (badge: text 1))',
        '',
      ].join('\n')
    );
  });

  it('writes one line per root inline', () => {
    expect(format(doc, { style: 'inline' })).toBe(
      '(ok: button (label OK) (on press (navigate home)) (badge: text 1))\n'
    );
  });

  it('writes the indented form without element parentheses', () => {
    expect(format(doc, { style: 'indented' })).toBe(
      [
        'ok: button',
        '  (label OK)',
        '  (on press (navigate home))',
        '  badge: text 1',
        '',
      ].join('\n')
    );
  });

  it('honours a custom indent', () => {
    expect(format(doc, { style: 'multiline', indent: '    ' })).toContain(
      '\n    (label OK)'
    );
  });

  it('writes an empty document as an empty string', () => {
    expect(format(parse(''))).toBe('');
  });

  it('rejects an unknown style', () => {
    expect(() => format(doc, { style: 'yaml' })).toThrow();
  });
});
