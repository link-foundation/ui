/**
 * parse(), the element rules (docs/spec/elements.md), walk(), projectLink()
 * and the vocabulary.
 */

import { describe, it, expect } from 'test-anywhere';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Link, Parser } from 'links-notation';
import {
  defaultVocabulary,
  loadVocabulary,
  parse,
  projectLink,
  SPEC_VERSION,
  toTree,
  UI_DIALECT_VERSION,
  valueMatches,
  walk,
} from '@link-foundation/ui-core';
import { VOCABULARY_TEXT } from '../src/vocabulary-text.js';
import { REPO, read, samples } from './helpers.js';

const node = (fields) => ({
  id: null,
  kind: null,
  positional: [],
  properties: [],
  children: [],
  unknown: [],
  ...fields,
});

describe('parse', () => {
  it('reads the example of the issue', () => {
    const doc = parse(
      "(ok: button (label 'OK') (variant filled) (on press (navigate home)))"
    );
    expect(doc.spec).toBe('ui-dialect/0');
    expect(doc.diagnostics).toEqual([]);
    expect(doc.roots).toEqual([
      node({
        id: 'ok',
        kind: 'button',
        properties: [
          { name: 'label', values: ['OK'] },
          { name: 'variant', values: ['filled'] },
          { name: 'on', values: ['press', ['navigate', 'home']] },
        ],
      }),
    ]);
    expect(doc.byId.get('ok')).toBe(doc.roots[0]);
  });

  it('applies the element rules in order', () => {
    // positional atom, child with id, property, anonymous child, unknown
    const doc = parse(
      "(card: stack (gap 8px) (title: text 'Hi') (text 'Body') (glow 2))"
    );
    const [card] = doc.roots;
    expect(card.properties).toEqual([{ name: 'gap', values: ['8px'] }]);
    expect(card.children).toEqual([
      node({ id: 'title', kind: 'text', positional: ['Hi'] }),
      node({ kind: 'text', positional: ['Body'] }),
    ]);
    expect(card.unknown).toEqual([['glow', '2']]);
    expect(codesOf(doc)).toEqual(['unknown-sublink']);
  });

  it('prefers a declared property over a kind of the same name', () => {
    // `text` is a kind, but not a property of stack; `value` is a property of text.
    const doc = parse("(t: text (value 'x'))");
    expect(doc.roots[0].properties).toEqual([{ name: 'value', values: ['x'] }]);
  });

  it('keeps nested links as arrays and links with ids as { id, values }', () => {
    const doc = parse('(s: stack (gap (or (token a) (b: c d))))');
    expect(doc.roots[0].properties[0].values).toEqual([
      ['or', ['token', 'a'], { id: 'b', values: ['c', 'd'] }],
    ]);
  });

  it('reads several roots and keeps their order', () => {
    const doc = parse('(a: text x)\n(b: text y)\n(text z)');
    expect(doc.roots.map((r) => r.id)).toEqual(['a', 'b', null]);
  });

  it('reads an empty document', () => {
    const doc = parse('');
    expect(toTree(doc)).toEqual({
      spec: SPEC_VERSION,
      elements: [],
      diagnostics: [],
    });
  });

  it('reads samples/indented.lino', () => {
    const doc = parse(
      read(join(REPO, 'docs/case-studies/issue-1/samples/indented.lino'))
    );
    expect(doc.diagnostics).toEqual([]);
    expect([...doc.byId.keys()]).toEqual(['app', 'body', 'greeting', 'ok']);
    expect(doc.byId.get('ok').properties).toEqual([
      { name: 'label', values: ['OK'] },
    ]);
  });

  for (const { name, text } of samples()) {
    it(`reads sample ${name} without diagnostics`, () => {
      const doc = parse(text);
      expect(doc.diagnostics).toEqual([]);
      expect(doc.roots.length).toBeGreaterThan(0);
    });
  }

  it('uses a custom vocabulary', () => {
    const vocabulary = loadVocabulary(
      '(card: kind (property elevation number) (children any))'
    );
    const doc = parse('(c: card (elevation 2) (elevation x))', { vocabulary });
    expect(doc.roots[0].properties).toEqual([
      { name: 'elevation', values: ['x'] },
    ]);
    expect(codesOf(doc).sort()).toEqual([
      'duplicate-property',
      'invalid-value',
    ]);
    expect(
      codesOf(parse('(c: card (elevation x))', { vocabulary, checks: false }))
    ).toEqual([]);
  });
});

function codesOf(doc) {
  return doc.diagnostics.map((d) => d.code);
}

describe('walk', () => {
  const doc = parse(
    read(join(REPO, 'docs/case-studies/issue-1/samples/document.lino'))
  );

  it('visits every element depth-first with its parent and depth', () => {
    const seen = [];
    walk(doc, (n, parent, depth) => {
      seen.push([n.id, parent?.id ?? null, depth]);
    });
    expect(seen).toEqual([
      ['app', null, 0],
      ['body', 'app', 1],
      ['greeting', 'body', 2],
      ['ok', 'body', 2],
    ]);
  });

  it('skips the children of an element when the visitor returns false', () => {
    const seen = [];
    walk(doc, (n) => {
      seen.push(n.id);
      return n.id !== 'body';
    });
    expect(seen).toEqual(['app', 'body']);
  });

  it('walks from one node', () => {
    const seen = [];
    walk(doc.byId.get('body'), (n) => {
      seen.push(n.id);
    });
    expect(seen).toEqual(['body', 'greeting', 'ok']);
  });
});

describe('projectLink', () => {
  it('projects one Link from links-notation', () => {
    const [link] = new Parser().parse('(ok: button (label OK) (colour red))');
    const diagnostics = [];
    const element = projectLink(link, defaultVocabulary(), diagnostics);
    expect(element.id).toBe('ok');
    expect(element.properties).toEqual([{ name: 'label', values: ['OK'] }]);
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-sublink']);
  });

  it('returns null for a link that is not an element', () => {
    expect(
      projectLink(new Link(null, [new Link('x')]), defaultVocabulary())
    ).toBe(null);
  });
});

describe('vocabulary', () => {
  it('embeds docs/spec/vocabulary.lino byte for byte', () => {
    expect(VOCABULARY_TEXT).toBe(read(join(REPO, 'docs/spec/vocabulary.lino')));
  });

  it('reads kinds, properties, actions and multi-valued names', () => {
    const vocabulary = defaultVocabulary();
    expect(vocabulary.version).toBe(UI_DIALECT_VERSION);
    expect(vocabulary.kinds.get('button').properties.get('on')).toEqual({
      type: 'action',
      multi: true,
    });
    expect(
      vocabulary.kinds.get('stack').properties.get('direction').type
    ).toEqual(['enum', 'vertical', 'horizontal']);
    expect(vocabulary.kinds.get('text').children).toBe('none');
    expect([...vocabulary.actions.keys()]).toContain('navigate');
    expect(vocabulary.multiValued.has('token')).toBe(true);
  });

  it('refuses a vocabulary with problems', () => {
    expect(() => loadVocabulary('(card: kind (colour red))')).toThrow();
  });

  it('checks values against the property types', () => {
    const cases = [
      ['dimension', '8px', true],
      ['dimension', '-1.5rem', true],
      ['dimension', '0', true],
      ['dimension', '8', false],
      ['dimension', 'px', false],
      ['number', '1e3', true],
      ['number', '.5', true],
      ['number', '1.', false],
      ['duration', '200ms', true],
      ['duration', '-1s', false],
      ['color', '#0af', true],
      ['color', '#0af1', true],
      ['color', '#12345', false],
      ['color', ['oklch', '70%', '0.1', '200'], true],
      ['color', ['hsl', '1', '2', '3'], false],
      ['url', 'https://x.org', true],
      ['url', 'javascript:alert(1)', false],
      ['url', './a.png', true],
      ['token-name', 'space.medium', true],
      ['token-name', 'Space', false],
      [['enum', 'a', 'b'], 'b', true],
      [['enum', 'a', 'b'], 'c', false],
      ['dimension', ['token', 'space.medium'], true],
      ['dimension', ['or', ['token', 'a'], '4px'], true],
      ['dimension', ['or', ['token', 'a'], '4'], false],
      ['dimension', '@space', true],
      ['any', ['a'], true],
      ['string', ['a'], false],
    ];
    for (const [type, value, expected] of cases) {
      expect([type, value, valueMatches(type, value)]).toEqual([
        type,
        value,
        expected,
      ]);
    }
  });
});

describe('source rules', () => {
  // The issue requires that no regular expression reads LiNo structure; the
  // package uses none at all.
  it('uses no regular expressions in src/', () => {
    const dir = join(REPO, 'packages/ui-core/src');
    for (const file of readdirSync(dir)) {
      const text = read(join(dir, file));
      for (const pattern of ['new RegExp', '.match(', '.replace(/', '.test(']) {
        expect([file, pattern, text.includes(pattern)]).toEqual([
          file,
          pattern,
          false,
        ]);
      }
    }
  });
});
