/**
 * importHtml: HTML text -> UI dialect (fixtures, spans, options).
 */

import { describe, it, expect } from 'test-anywhere';
import { formatLinks } from 'links-notation';
import { importHtml } from '@link-foundation/ui-convert';
import { fixtures } from './helpers.js';

describe('importHtml fixtures', () => {
  for (const { name, html, lino } of fixtures()) {
    it(`${name}.html gives ${name}.lino`, () => {
      expect(importHtml(html).text).toBe(lino);
    });

    it(`${name}.html: every span slices to the element's own source`, () => {
      const { spans, tree } = importHtml(html);
      expect(spans.size > 0).toBe(true);
      for (const [id, { start, end }] of spans) {
        const source = html.slice(start, end);
        const node = tree.byId.get(id);
        const tag = node.properties.find((p) => p.name === 'tag')?.values[0];
        if (tag !== undefined) {
          expect(source.startsWith(`<${tag}`)).toBe(true);
        } else if (node.kind === 'text' && id.startsWith('text-')) {
          expect(source.length > 0).toBe(true);
        } else {
          expect(source.startsWith('<')).toBe(true);
        }
      }
    });
  }
});

describe('importHtml', () => {
  it('imports the example of the issue', () => {
    const { text, diagnostics } = importHtml(
      '<button id="ok" class="primary">OK</button>'
    );
    expect(text).toBe('ok: button\n  label OK\n  attr class primary\n');
    expect(diagnostics).toEqual([]);
  });

  it('gives spans that start at the tag name', () => {
    const html = '<main>\n  <button id="ok">OK</button>\n</main>';
    const { spans } = importHtml(html);
    const { start, end } = spans.get('ok');
    expect(html.slice(start, end)).toBe('<button id="ok">OK</button>');
    expect(html.slice(start + 1, start + 1 + 'button'.length)).toBe('button');
  });

  it('writes one link per element with style inline (formatLinks)', () => {
    const result = importHtml('<div><p>A</p><p>B</p></div><p>C</p>', {
      style: 'inline',
    });
    expect(result.text).toBe(`${formatLinks(result.links)}\n`);
    expect(result.text.split('\n').length).toBe(3);
  });

  it('reads a whole document with options.document', () => {
    const { text } = importHtml(
      '<!doctype html><html><head><title>T</title></head><body><p>Hi</p></body></html>',
      { document: true }
    );
    expect(text.startsWith('html-0: html\n  tag html\n')).toBe(true);
    expect(text.includes('\n    p-0-1-0: text Hi\n')).toBe(true);
  });

  it('keeps comments only with options.comments', () => {
    const html = '<div><!-- note --><p>A</p></div>';
    expect(importHtml(html).text.includes('comment')).toBe(false);
    const { text } = importHtml(html, { comments: true });
    expect(text.includes("\n  comment-0-0: comment ' note '\n")).toBe(true);
    expect(text.includes('\n  p-0-1: text A\n')).toBe(true);
  });

  it('collapses whitespace except inside pre and textarea', () => {
    const { tree } = importHtml('<p>  a \n  b  </p><pre> x\n y</pre>');
    expect(tree.roots[0].positional).toEqual(['a b']);
    expect(tree.roots[1].children[0].positional).toEqual([' x\n y']);
  });

  it('rejects input that is not text', () => {
    expect(() => importHtml(null)).toThrow();
  });
});
