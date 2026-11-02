/**
 * `indexSource(text)` maps every element, property and value to its span,
 * each span confirmed by the official parser.
 */

import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import {
  SourceIndexError,
  findElement,
  indexSource,
} from '@link-foundation/ui-core/source';
import { samples, sourceFixtures, specFixtures } from './helpers.js';

// Fixtures whose text the parser rejects: there is nothing to index.
const PARSER_ERRORS = new Set([
  'syntax-error',
  'depth-exceeded',
  'input-too-large',
]);
const parses = (text) =>
  !parse(text).diagnostics.some((d) => PARSER_ERRORS.has(d.code));

const inputs = [
  ...samples().map((s) => ({ ...s, name: `sample ${s.name}` })),
  ...specFixtures().map((f) => ({ ...f, name: `fixture ${f.name}` })),
  ...sourceFixtures().map((f) => ({ ...f, name: `source ${f.name}` })),
];

/** Check that every span lies in its parent, in order, and names itself. */
function checkTree(text, node, ids) {
  let last = node.start;
  for (const child of node.children) {
    expect(child.start >= last, `${child.kind} starts in order`).toBe(true);
    expect(child.end <= node.end, `${child.kind} ends in its parent`).toBe(
      true
    );
    last = child.end;
    if (child.kind === 'element' && child.id !== null) {
      ids.push(child.id);
      expect(text.slice(child.idSpan.start, child.idSpan.end)).toContain(
        child.id
      );
    }
    if (child.kind === 'prop') {
      expect(text.slice(child.nameSpan.start, child.nameSpan.end)).toBe(
        child.name
      );
    }
    checkTree(text, child, ids);
  }
}

describe('indexSource', () => {
  const valid = inputs.filter(({ text }) => parses(text));

  it('indexes every sample and fixture that parses', () => {
    expect(valid.length > 60).toBe(true);
    expect(inputs.length - valid.length).toBe(3);
  });

  for (const { name, text } of valid) {
    it(name, () => {
      const { root, document } = indexSource(text);
      const ids = [];
      checkTree(text, root, ids);
      expect(ids.filter((id, i) => ids.indexOf(id) === i).sort()).toEqual(
        [...document.byId.keys()].sort()
      );
    });
  }

  it('maps the example of the issue to its spans', () => {
    const text =
      "# primary action\n(ok: button\n  (label 'OK')   # shown on the button\n  (variant filled))\n";
    const { root, form } = indexSource(text);
    expect(form).toBe('multiline');
    const { node } = findElement(root, 'ok');
    expect(text.slice(node.start, node.end)).toBe(
      "(ok: button\n  (label 'OK')   # shown on the button\n  (variant filled))"
    );
    expect(node.form).toBe('multiline');
    const label = node.children.find((c) => c.name === 'label');
    expect(text.slice(label.start, label.end)).toBe("(label 'OK')");
    const value = label.children.find((c) => c.kind === 'value');
    expect([value.start, value.end, value.text]).toEqual([38, 42, 'OK']);
  });

  it('tells the three document forms apart', () => {
    const forms = Object.fromEntries(
      sourceFixtures()
        .filter((f) => f.name.startsWith('form.'))
        .map((f) => [f.name, indexSource(f.text).form])
    );
    expect(forms).toEqual({
      'form.indented.lino': 'indented',
      'form.multiline.lino': 'multiline',
      'form.one-line.lino': 'inline',
    });
  });

  it('finds the indentation unit of the text', () => {
    expect(indexSource('a: stack\n    b: text B\n').unit).toBe('    ');
    expect(indexSource('(a: text A)\n').unit).toBe('  ');
  });

  it('marks an earlier duplicate property as shadowed', () => {
    const { root } = indexSource('(a: text A (style s1) (style s2))');
    const props = findElement(root, 'a').node.children.filter(
      (c) => c.kind === 'prop'
    );
    expect(props.map((p) => Boolean(p.shadowed))).toEqual([true, false]);
  });

  it('throws a SourceIndexError on text the parser rejects', () => {
    expect(() => indexSource('(a: text A')).toThrow();
    expect(() => indexSource(42)).toThrow();
    let error;
    try {
      indexSource('(a: text A');
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof SourceIndexError).toBe(true);
  });
});
