/**
 * Round trip: import -> parse with ui-core -> format gives the same links.
 *
 * Multiline text is read by `links-notation` as path links that ui-core
 * folds back (docs/spec/projection.md), so the links are compared on the
 * inline style, where the official parser returns them as they were built,
 * and on the projected element trees for every style.
 */

import { describe, it, expect } from 'test-anywhere';
import { Parser } from 'links-notation';
import { format, parse } from '@link-foundation/ui-core';
import { htmlVocabulary, importHtml } from '@link-foundation/ui-convert';
import { fixtures } from './helpers.js';

const STYLES = ['multiline', 'inline', 'indented'];

const sameLinks = (a, b) =>
  a.length === b.length && a.every((link, i) => link.equals(b[i]));

const parseHtmlDialect = (text) =>
  parse(text, { vocabulary: htmlVocabulary() });

describe('roundtrip', () => {
  for (const { name, html } of fixtures()) {
    it(`${name}: the output parses without diagnostics`, () => {
      const { text } = importHtml(html);
      expect(parseHtmlDialect(text).diagnostics).toEqual([]);
    });

    it(`${name}: formatting the parsed document gives the same text`, () => {
      const { text } = importHtml(html);
      expect(format(parseHtmlDialect(text))).toBe(text);
    });

    it(`${name}: every format style gives the same elements`, () => {
      const { text, tree } = importHtml(html);
      const doc = parseHtmlDialect(text);
      for (const style of STYLES) {
        const again = parseHtmlDialect(format(doc, { style }));
        expect(again.diagnostics).toEqual([]);
        expect(again.roots).toEqual(tree.roots);
      }
    });

    it(`${name}: the inline style reads back as the built links`, () => {
      const { text, links } = importHtml(html);
      const inline = format(parseHtmlDialect(text), { style: 'inline' });
      expect(sameLinks(new Parser().parse(inline), links)).toBe(true);
      const direct = importHtml(html, { style: 'inline' }).text;
      expect(direct).toBe(inline);
    });
  }

  it('keeps the dialect kinds readable with the default vocabulary', () => {
    const { text } = importHtml('<h1>Title</h1><button>OK</button>');
    const doc = parse(text);
    expect(doc.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(doc.roots.map((node) => node.kind)).toEqual(['text', 'button']);
  });
});
