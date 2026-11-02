/**
 * Link ids: deterministic, unique, from `id` attributes or element paths.
 */

import { describe, it, expect } from 'test-anywhere';
import { assignIds, importHtml, isValidId } from '@link-foundation/ui-convert';
import { fixtures } from './helpers.js';

const ids = (html) => [...importHtml(html).tree.byId.keys()];

describe('ids', () => {
  it('are deterministic: importing twice gives identical text', () => {
    for (const { html } of fixtures()) {
      expect(importHtml(html).text).toBe(importHtml(html).text);
    }
  });

  it('are unique in every fixture', () => {
    for (const { html } of fixtures()) {
      const { tree, diagnostics } = importHtml(html);
      const all = [];
      const visit = (node) => {
        all.push(node.id);
        node.children.forEach(visit);
      };
      tree.roots.forEach(visit);
      expect(new Set(all).size).toBe(all.length);
      expect(diagnostics.some((d) => d.code === 'duplicate-id')).toBe(false);
    }
  });

  it('use a valid unique id attribute', () => {
    expect(ids('<div id="app"><p id="intro">Hi</p></div>')).toEqual([
      'app',
      'intro',
    ]);
  });

  it('use path ids from the tag and sibling indices', () => {
    expect(
      ids('<div><p>a</p><div><span>b</span><div><p>c</p></div></div></div>')
    ).toEqual([
      'div-0',
      'p-0-0',
      'div-0-1',
      'span-0-1-0',
      'div-0-1-1',
      'p-0-1-1-0',
    ]);
  });

  it('give duplicate id attributes suffixes and keep the original id', () => {
    const { text } = importHtml(
      '<p id="x">1</p><p id="x">2</p><p id="x">3</p>'
    );
    expect(text).toBe(
      [
        '(x: text 1',
        '  (tag p))',
        '(x-2: text 2',
        '  (tag p)',
        '  (attr id x))',
        '(x-3: text 3',
        '  (tag p)',
        '  (attr id x))',
        '',
      ].join('\n')
    );
  });

  it('skip suffixes and path ids that an id attribute already takes', () => {
    expect(ids('<p id="x">1</p><p id="x">2</p><p id="x-2">3</p>')).toEqual([
      'x',
      'x-3',
      'x-2',
    ]);
    expect(ids('<p>1</p><p id="p-0">2</p>')).toEqual(['p-0-2', 'p-0']);
  });

  it('replace ids that are not valid references with path ids', () => {
    for (const id of ['a b', 'a:b', '@x', '$x', '', "it's", '(x)']) {
      const { tree } = importHtml(`<p id="${id}">Hi</p>`);
      expect(tree.roots[0].id).toBe('p-0');
    }
    expect(isValidId('main-nav')).toBe(true);
    expect(isValidId('привет')).toBe(true);
    expect(isValidId('a:b')).toBe(false);
  });

  it('assignIds walks the intermediate form in document order', () => {
    const text = { tag: '#text', attrs: [], children: [], text: 'Hi' };
    const p = { tag: 'p', attrs: [], children: [text] };
    const assigned = assignIds([p]);
    expect([...assigned.values()]).toEqual(['p-0', 'text-0-0']);
  });
});
