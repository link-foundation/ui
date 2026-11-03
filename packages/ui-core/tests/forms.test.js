/**
 * The forms of one document (one line, multi-line parentheses, indented
 * with inline links, and the nested form of the sample, the default since
 * #133) give the same tree (docs/spec/projection.md).
 */

import { describe, it, expect } from 'test-anywhere';
import { join } from 'node:path';
import { parse, toTree } from '@link-foundation/ui-core';
import {
  LOCAL_FIXTURES_DIR,
  SAMPLES_DIR,
  read,
  specFixtures,
} from './helpers.js';

const nested = read(join(SAMPLES_DIR, 'document.lino'));
const multiLine = read(join(LOCAL_FIXTURES_DIR, 'document.multiline.lino'));
const oneLine = read(join(LOCAL_FIXTURES_DIR, 'document.one-line.lino'));
const indented = read(join(LOCAL_FIXTURES_DIR, 'document.indented.lino'));

describe('four forms of samples/document.lino', () => {
  const trees = [nested, multiLine, oneLine, indented].map((text) =>
    parse(text)
  );

  it('are really written in four different ways', () => {
    expect(new Set([nested, multiLine, oneLine, indented]).size).toBe(4);
    expect(oneLine.trim().includes('\n')).toBe(false);
    expect(indented.includes('(app:')).toBe(false);
    expect(indented.includes('(')).toBe(true);
    // The nested form needs no parentheses at all.
    expect(nested.includes('(')).toBe(false);
  });

  it('give deep-equal trees with no diagnostics', () => {
    for (const doc of trees) {
      expect(doc.diagnostics).toEqual([]);
      expect(doc.roots).toEqual(trees[0].roots);
      expect(toTree(doc)).toEqual(toTree(trees[0]));
    }
  });

  it('have the root app (document) with body (stack) holding greeting and ok', () => {
    for (const doc of trees) {
      const [app] = doc.roots;
      expect(doc.roots.length).toBe(1);
      expect({ id: app.id, kind: app.kind }).toEqual({
        id: 'app',
        kind: 'document',
      });
      expect(app.children.map(({ id, kind }) => ({ id, kind }))).toEqual([
        { id: 'body', kind: 'stack' },
      ]);
      const [body] = app.children;
      expect(body.children.map(({ id, kind }) => ({ id, kind }))).toEqual([
        { id: 'greeting', kind: 'text' },
        { id: 'ok', kind: 'button' },
      ]);
      expect(body.children[0].positional).toEqual(['Hello, links']);
      expect(body.children[1].properties).toEqual([
        { name: 'label', values: ['OK'] },
        { name: 'variant', values: ['filled'] },
        { name: 'on', values: ['press', ['navigate', 'home']] },
      ]);
      expect([...doc.byId.keys()]).toEqual(['app', 'body', 'greeting', 'ok']);
    }
  });
});

describe('parse modes', () => {
  // `auto` and `groups` read Parser.parseGroups(); `fold` path-folds
  // Parser.parse(). The spec requires both to give the same tree.
  for (const { name, text } of specFixtures()) {
    it(`fold and groups agree on ${name}`, () => {
      const fold = toTree(parse(text, { mode: 'fold' }));
      expect(toTree(parse(text, { mode: 'groups' }))).toEqual(fold);
      expect(toTree(parse(text))).toEqual(fold);
    });
  }

  it('agree on a multi-line anonymous child with properties', () => {
    // The reference projection nests a second `text` here; the tree has one.
    const text = "(s: stack\n  (text 'First'\n    (style x)\n    (value y)))\n";
    for (const mode of ['fold', 'groups']) {
      const [stack] = parse(text, { mode }).roots;
      expect(stack.children.length).toBe(1);
      expect(stack.children[0].children).toEqual([]);
      expect(stack.children[0].properties.map((p) => p.name)).toEqual([
        'style',
        'value',
      ]);
    }
  });

  it('keep two multi-line handlers with the same event apart', () => {
    const text = [
      '(ok: button',
      '  (on press',
      '    (navigate home))',
      '  (on press',
      '    (navigate home)))',
      '',
    ].join('\n');
    const one =
      '(ok: button (on press (navigate home)) (on press (navigate home)))';
    expect(parse(text).roots).toEqual(parse(one).roots);
    expect(parse(text, { mode: 'fold' }).roots).toEqual(parse(one).roots);
    expect(parse(one).roots[0].properties.length).toBe(2);
  });

  it('fold an unknown sublink with indented lines the same way in every form', () => {
    const forms = [
      '(ok: button (colour red (shade dark)))',
      '(ok: button\n  (colour red\n    (shade dark)))',
      'ok: button\n  colour red\n    shade dark',
    ];
    const [first, ...rest] = forms.map((text) => toTree(parse(text)));
    expect(first.elements[0].unknown).toEqual([
      ['colour', 'red', ['shade', 'dark']],
    ]);
    for (const tree of rest) {
      expect(tree).toEqual(first);
    }
  });
});
