/**
 * importDom: a live DOM (jsdom) -> UI dialect, with `nodeMap`.
 */

import { describe, it, expect } from 'test-anywhere';
import { JSDOM } from 'jsdom';
import { importDom, importHtml } from '@link-foundation/ui-convert';
import { domFragment, fixtures } from './helpers.js';

describe('importDom fixtures', () => {
  for (const { name, html } of fixtures()) {
    it(`${name}.html: importDom gives the same text as importHtml`, () => {
      expect(importDom(domFragment(html)).text).toBe(importHtml(html).text);
    });

    it(`${name}.html: nodeMap holds the original DOM nodes`, () => {
      const fragment = domFragment(html);
      const { nodeMap, tree } = importDom(fragment);
      expect(nodeMap.size).toBe(tree.byId.size);
      for (const [id, node] of nodeMap) {
        expect(tree.byId.has(id)).toBe(true);
        expect(fragment.contains(node)).toBe(true);
      }
    });
  }
});

describe('importDom', () => {
  it('maps link ids to the very same DOM nodes', () => {
    const fragment = domFragment(
      '<div><button id="ok">OK</button><p>Hi <b>you</b></p></div>'
    );
    const { nodeMap } = importDom(fragment);
    expect(nodeMap.get('ok')).toBe(fragment.querySelector('#ok'));
    expect(nodeMap.get('div-0')).toBe(fragment.firstChild);
    expect(nodeMap.get('b-0-1-1')).toBe(fragment.querySelector('b'));
    expect(nodeMap.get('text-0-1-0')).toBe(
      fragment.querySelector('p').firstChild
    );
  });

  it('imports an element subtree of a live document', () => {
    const { document } = new JSDOM(
      '<body><nav id="menu"><a href="/">Home</a></nav><p>Other</p></body>'
    ).window;
    const { text, nodeMap } = importDom(document.getElementById('menu'));
    expect(text.startsWith('menu: html\n  tag nav\n')).toBe(true);
    expect(text.includes('Other')).toBe(false);
    expect(nodeMap.get('menu')).toBe(document.getElementById('menu'));
  });

  it('imports the content of a template element', () => {
    const { document } = new JSDOM('<template id="t"><p>Inside</p></template>')
      .window;
    const { text } = importDom(document.querySelector('template'));
    expect(text.includes('\n  p-0-0: text Inside\n')).toBe(true);
  });

  it('reads spans through options.location (jsdom nodeLocation)', () => {
    const html = '<main>\n  <p id="hi">Hi</p>\n</main>';
    const dom = new JSDOM(html, { includeNodeLocations: true });
    const body = dom.window.document.body;
    const { spans } = importDom(body.firstChild, {
      location: (node) => dom.nodeLocation(node),
    });
    const { start, end } = spans.get('hi');
    expect(html.slice(start, end)).toBe('<p id="hi">Hi</p>');
  });

  it('rejects input that is not a DOM node', () => {
    expect(() => importDom('<p>Hi</p>')).toThrow();
  });
});
