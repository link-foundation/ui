/**
 * The mapping table: HTML elements -> dialect kinds, with the lossless
 * `html` fallback for kinds the vocabulary (#11) does not have.
 */

import { describe, it, expect } from 'test-anywhere';
import { defaultVocabulary } from '@link-foundation/ui-core';
import {
  HTML_MAPPING,
  extendVocabulary,
  findRule,
  htmlVocabulary,
  importHtml,
} from '@link-foundation/ui-convert';

const first = (html, options) => importHtml(html, options).tree.roots[0];
const props = (node) =>
  Object.fromEntries(node.properties.map((p) => [p.name, p.values]));

describe('HTML_MAPPING', () => {
  it('is plain data that names a kind for every rule', () => {
    expect(Object.isFrozen(HTML_MAPPING)).toBe(true);
    for (const rule of HTML_MAPPING) {
      expect(Array.isArray(rule.tags)).toBe(true);
      expect(typeof rule.kind).toBe('string');
    }
    expect(JSON.parse(JSON.stringify(HTML_MAPPING))).toEqual([...HTML_MAPPING]);
  });

  it('uses only the kinds of the vocabulary', () => {
    const vocabulary = defaultVocabulary();
    const div = { tag: 'div', attrs: [], children: [] };
    const a = { tag: 'a', attrs: [['href', '/']], children: [] };
    expect(findRule(div, vocabulary)).toBe(undefined);
    expect(findRule(a, vocabulary)).toBe(undefined);
    const button = { tag: 'button', attrs: [], children: [] };
    expect(findRule(button, vocabulary).kind).toBe('button');
  });
});

describe('mapping', () => {
  it('maps button and input[type=button] to button with a label', () => {
    expect(first('<button>Save</button>').kind).toBe('button');
    expect(props(first('<button>Save</button>'))).toEqual({
      label: ['Save'],
    });
    const input = first('<input type="button" value="Go">');
    expect(input.kind).toBe('button');
    expect(props(input)).toEqual({
      label: ['Go'],
      tag: ['input'],
      attr: ['type', 'button'],
    });
  });

  it('maps p, span and label to text with their tag', () => {
    for (const tag of ['p', 'span', 'label']) {
      const node = first(`<${tag}>Hi</${tag}>`);
      expect(node.kind).toBe('text');
      expect(node.positional).toEqual(['Hi']);
      expect(props(node).tag).toEqual([tag]);
    }
  });

  it('maps h1-h6 to text with a level', () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
      const node = first(`<h${level}>Title</h${level}>`);
      expect(node.kind).toBe('text');
      expect(props(node)).toEqual({ level: [String(level)] });
    }
  });

  it('maps img to image with source and alt', () => {
    const node = first('<img src="https://example.com/a.png" alt="A">');
    expect(node.kind).toBe('image');
    expect(props(node)).toEqual({
      source: ['https://example.com/a.png'],
      alt: ['A'],
    });
  });

  it('keeps a source that is not a url type value as an attribute', () => {
    const node = first('<img src="ftp://example.com/a.png">');
    expect(props(node)).toEqual({ attr: ['src', 'ftp://example.com/a.png'] });
  });

  it('falls back to html for kinds missing in #11 (link, checkbox, list)', () => {
    const html =
      '<a href="/docs">Docs</a><input type="checkbox"><input type="text"><textarea>x</textarea><ul><li>1</li></ul>';
    const roots = importHtml(html).tree.roots;
    expect(roots.map((node) => node.kind)).toEqual([
      'html',
      'html',
      'html',
      'html',
      'html',
    ]);
    expect(roots.map((node) => props(node).tag[0])).toEqual([
      'a',
      'input',
      'input',
      'textarea',
      'ul',
    ]);
  });

  it('uses a table kind when the vocabulary has it', () => {
    const vocabulary = extendVocabulary(
      htmlVocabulary(),
      `(link: kind
  (property label string)
  (property href url)
  (property attr any multi)
  (children none))
(list: kind
  (property tag string)
  (property attr any multi)
  (children any))`
    );
    const { text, diagnostics } = importHtml(
      '<a href="/docs" class="nav">Docs</a><ol><li>One</li></ol>',
      { vocabulary }
    );
    expect(diagnostics).toEqual([]);
    expect(text).toBe(
      [
        '(a-0: link',
        '  (label Docs)',
        '  (href /docs)',
        '  (attr class nav))',
        '(ol-1: list',
        '  (tag ol)',
        '  (li-1-0: html',
        '    (tag li)',
        '    (text-1-0-0: text One)))',
        '',
      ].join('\n')
    );
  });

  it('keeps every attribute of the html fallback', () => {
    const { text } = importHtml(
      '<div class="card" data-id="7" hidden aria-label="Card one"></div>'
    );
    expect(text).toBe(
      [
        '(div-0: html',
        '  (tag div)',
        '  (attr class card)',
        '  (attr data-id 7)',
        '  (attr hidden)',
        "  (attr aria-label 'Card one'))",
        '',
      ].join('\n')
    );
  });

  it('uses the html fallback for text elements with element children', () => {
    const node = first('<p>Hello <b>world</b></p>');
    expect(node.kind).toBe('html');
    expect(node.children.map((child) => child.kind)).toEqual(['text', 'html']);
    expect(node.children[0].positional).toEqual(['Hello ']);
  });

  it('accepts a custom table', () => {
    const mapping = [{ tags: ['div'], kind: 'stack', tag: 'div' }];
    const { tree, diagnostics } = importHtml('<div><p>A</p></div>', {
      mapping,
    });
    expect(diagnostics).toEqual([]);
    const [node] = tree.roots;
    expect(node.kind).toBe('stack');
    expect(props(node)).toEqual({});
    // p has no rule in this table, so it uses the html fallback.
    expect(node.children[0].kind).toBe('html');
  });
});
