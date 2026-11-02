/**
 * `applyOpsToSource(text, ops)` applies the ops of the store in order, with
 * a tree check after each one, all or nothing.
 */

import { describe, it, expect } from 'test-anywhere';
import { stripComments } from 'links-notation';
import { format, parse } from '@link-foundation/ui-core';
import {
  OP_NAMES,
  applyOpToTree,
  applyOpsToSource,
} from '@link-foundation/ui-core/source';
import { commentsOf, shape, sourceFixtures } from './helpers.js';

const comments = (text) => commentsOf(text, stripComments);
const fixture = (name) =>
  sourceFixtures().find((f) => f.name === `${name}.lino`).text;

const node = (lino) => parse(lino).roots[0];

const OPS = [
  {
    op: 'insert',
    parentId: 'body',
    index: 0,
    node: node('(intro: text Welcome)'),
  },
  { op: 'setProp', id: 'ok', name: 'label', values: ['Confirm'] },
  { op: 'move', id: 'cancel', parentId: 'body', index: 1 },
  { op: 'rename', id: 'greeting', to: 'hello' },
  { op: 'removeProp', id: 'ok', name: 'variant' },
  { op: 'setPositional', id: 'hello', values: ['Hello again'] },
  { op: 'remove', id: 'intro' },
];

/** The tree the ops give on the parsed text. */
function expectedTree(text, ops) {
  let tree = shape(parse(text));
  for (const op of ops) {
    const result = applyOpToTree(tree, op);
    expect(result.ok, result.error).toBe(true);
    tree = result.tree;
  }
  return tree;
}

describe('applyOpsToSource', () => {
  it('knows every op of the store', () => {
    for (const name of [
      'insert',
      'remove',
      'move',
      'setProp',
      'removeProp',
      'rename',
    ]) {
      expect(OP_NAMES).toContain(name);
    }
  });

  for (const form of ['one-line', 'multiline', 'indented']) {
    it(`applies a sequence of ops in the ${form} form`, () => {
      const text = fixture(`form.${form}`);
      const result = applyOpsToSource(text, OPS);
      expect(result.ok, result.error).toBe(true);
      expect(result.steps.length).toBe(OPS.length);
      expect(shape(parse(result.text))).toEqual(expectedTree(text, OPS));
      expect(comments(result.text)).toEqual(comments(text));
    });
  }

  it('writes an inserted node in the layout of the document', () => {
    const text = fixture('form.indented');
    const op = {
      op: 'insert',
      parentId: 'body',
      index: 3,
      node: node("(done: button (label 'Done') (variant filled))"),
    };
    const result = applyOpsToSource(text, [op]);
    expect(result.ok, result.error).toBe(true);
    // The node is written by `format` in the document's style and indent.
    expect(
      result.text.endsWith(
        '    done: button\n      (label Done)\n      (variant filled)\n'
      )
    ).toBe(true);
  });

  it('applies nothing when an op fails', () => {
    const text = fixture('form.multiline');
    const ops = [
      { op: 'setProp', id: 'ok', name: 'label', values: ['Yes'] },
      { op: 'remove', id: 'missing' },
      { op: 'rename', id: 'ok', to: 'yes' },
    ];
    const result = applyOpsToSource(text, ops);
    expect(result.ok).toBe(false);
    expect(result.index).toBe(1);
    expect(result.text).toBe(text);
    expect(typeof result.error).toBe('string');
  });

  it('refuses an unknown op and a non-array', () => {
    const text = fixture('example.multiline');
    expect(applyOpsToSource(text, [{ op: 'explode' }]).ok).toBe(false);
    expect(applyOpsToSource(text, null).ok).toBe(false);
  });

  it('returns the text unchanged for no ops', () => {
    const text = fixture('example.multiline');
    expect(applyOpsToSource(text, [])).toEqual({ ok: true, text, steps: [] });
  });
});

describe('note', () => {
  const text = "(ok: button\n  (label OK)\n  (note 'Why this is red'))\n";

  it('is a property of every kind', () => {
    const doc = parse(text);
    expect(doc.diagnostics).toEqual([]);
    expect(doc.byId.get('ok').properties).toEqual([
      { name: 'label', values: ['OK'] },
      { name: 'note', values: ['Why this is red'] },
    ]);
    for (const kind of ['text', 'stack', 'theme', 'document']) {
      const other = parse(`(x: ${kind} (note 'A note'))`);
      expect(other.diagnostics).toEqual([]);
      expect(other.byId.get('x').properties).toEqual([
        { name: 'note', values: ['A note'] },
      ]);
    }
  });

  for (const style of ['inline', 'multiline', 'indented']) {
    it(`survives parse and format (${style})`, () => {
      const doc = parse(text);
      const again = parse(format(doc, { style }));
      expect(shape(again)).toEqual(shape(doc));
      expect(format(doc, { style })).toContain('Why this is red');
    });
  }

  it('is set by applyOpsToSource like any property', () => {
    const op = { op: 'setProp', id: 'ok', name: 'note', values: ['Why not'] };
    const result = applyOpsToSource(text, [op]);
    expect(result.ok, result.error).toBe(true);
    expect(result.edits).toBeUndefined();
    expect(result.steps[0].edits.length).toBe(1);
    expect(result.text).toBe(text.replace("'Why this is red'", "'Why not'"));
  });
});
