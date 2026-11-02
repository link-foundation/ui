/**
 * Inline styles -> `(style ...)`, quoted by `escapeReference`.
 */

import { describe, it, expect } from 'test-anywhere';
import { Parser } from 'links-notation';
import { parse } from '@link-foundation/ui-core';
import {
  collapseCss,
  htmlVocabulary,
  importHtml,
  parseStyle,
  styleLink,
} from '@link-foundation/ui-convert';
import { fixtures } from './helpers.js';

const fixture = (name) => fixtures().find((f) => f.name === name);

describe('parseStyle', () => {
  it('splits declarations and trims them', () => {
    expect(parseStyle(' padding : 8px ; color:#3390ec;; ')).toEqual([
      ['padding', '8px'],
      ['color', '#3390ec'],
    ]);
  });

  it('keeps ; and : inside quotes and parentheses', () => {
    expect(
      parseStyle(
        "background: url('a;b:c.png'); content: \"x; y\"; font: 12px/1 'A B'"
      )
    ).toEqual([
      ['background', "url('a;b:c.png')"],
      ['content', '"x; y"'],
      ['font', "12px/1 'A B'"],
    ]);
  });

  it('drops comments, lower-cases names and keeps custom properties', () => {
    expect(
      parseStyle('COLOR: red /* note; */; --Brand:  #fff ; /* x */')
    ).toEqual([
      ['color', 'red'],
      ['--Brand', '#fff'],
    ]);
  });

  it('skips empty and malformed declarations', () => {
    expect(parseStyle('')).toEqual([]);
    expect(parseStyle('   ')).toEqual([]);
    expect(parseStyle('color; :red; width:')).toEqual([]);
  });

  it('collapses whitespace outside strings', () => {
    expect(collapseCss('  0\n   auto  ')).toBe('0 auto');
    expect(collapseCss("'a   b'   c")).toBe("'a   b' c");
  });
});

describe('style links', () => {
  it('quote hex colours, URLs and values with a colon', () => {
    const link = styleLink([
      ['padding', '8px'],
      ['color', '#3390ec'],
      ['background', 'url(https://example.com/a.png)'],
      ['grid-area', 'a:b'],
      ['margin', '0 auto'],
    ]);
    expect(link.format()).toBe(
      "(style (padding 8px) (color '#3390ec') (background 'url(https://example.com/a.png)') (grid-area 'a:b') (margin '0 auto'))"
    );
  });

  it('give no link for no declarations', () => {
    expect(styleLink([])).toBe(null);
  });

  it('import the example of the issue', () => {
    const { text } = importHtml(
      '<div style="padding: 8px; color: #3390ec"></div>'
    );
    expect(text.includes("(style (padding 8px) (color '#3390ec'))")).toBe(true);
  });

  it('inline-styles.html parses and keeps #3390ec', () => {
    const { text } = importHtml(fixture('inline-styles').html);
    expect(text.includes("(color '#3390ec')")).toBe(true);
    const doc = parse(text, { vocabulary: htmlVocabulary() });
    expect(doc.diagnostics).toEqual([]);
    const card = doc.byId.get('div-1');
    const style = card.properties.find((p) => p.name === 'style');
    const has = (pair) =>
      style.values.some((v) => JSON.stringify(v) === JSON.stringify(pair));
    expect(has(['color', '#3390ec'])).toBe(true);
  });

  it('keep <style> text as raw-css on the parent', () => {
    const { tree } = importHtml(
      '<div><style>.a { color: red }</style><p>Hi</p></div>'
    );
    const div = tree.roots[0];
    expect(div.properties.find((p) => p.name === 'raw-css').values).toEqual([
      '.a { color: red }',
    ]);
    expect(div.children.map((child) => child.id)).toEqual(['p-0-1']);
  });

  it('read back every quoted value with the official parser', () => {
    const { text } = importHtml(fixture('inline-styles').html);
    expect(() => new Parser().parse(text)).not.toThrow();
  });
});
