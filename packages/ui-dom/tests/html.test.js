/**
 * renderToHTML: static HTML with the tags and data-link-id of `render`,
 * every value escaped, and no event handler attributes or scripts.
 */

import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
import { renderToHTML as fromRoot } from '@link-foundation/ui-dom';
import {
  renderToHTML,
  createStaticDocument,
} from '@link-foundation/ui-dom/html';
import { createDom, sample, snapshot } from './setup-dom.js';

describe('renderToHTML', () => {
  it('matches the snapshot, and the live DOM', () => {
    const html = `${renderToHTML(sample('document'))}\n`;
    expect(html).toBe(snapshot('document.html', html));
    const { document } = createDom();
    const template = document.createElement('template');
    template.innerHTML = html;
    expect(template.content.querySelector('ui-button').localName).toBe(
      'ui-button'
    );
    expect(fromRoot).toBe(renderToHTML);
  });

  it('gives every rendered element its data-link-id', () => {
    const html = renderToHTML(sample('document'));
    const { document } = createDom();
    const template = document.createElement('template');
    template.innerHTML = html;
    const elements = [...template.content.querySelectorAll('*')];
    const rendered = elements.filter((el) => el.localName.startsWith('ui-'));
    expect(rendered.map((el) => el.getAttribute('data-link-id'))).toEqual([
      'app',
      'body',
      'greeting',
      'ok',
    ]);
    // The native button inside ui-button belongs to it.
    const inner = elements.filter((el) => !el.localName.startsWith('ui-'));
    expect(inner.map((el) => el.localName)).toEqual(['button']);
    expect(inner[0].parentNode.getAttribute('data-link-id')).toBe('ok');
  });

  it('accepts a store, a UiDocument, a node and a list of nodes', () => {
    const text = sample('document');
    const expected = renderToHTML(text);
    const parsed = parse(text);
    expect(renderToHTML(createStore({ text }))).toBe(expected);
    expect(renderToHTML(parsed)).toBe(expected);
    expect(renderToHTML(parsed.roots[0])).toBe(expected);
    expect(renderToHTML(parsed.roots)).toBe(expected);
  });

  it('escapes <, &, and quotes in text and attributes', () => {
    const html = renderToHTML(
      `(t: text 'a <b>&amp; "c"')
(u: text "it's")
(i: image 'x.png?a=1&b="2"' (alt '<script>alert(1)</script>'))
(b: button 'B' (variant '"><script>'))`
    );
    expect(html).toContain(
      '<ui-text data-link-id="t">a &lt;b&gt;&amp;amp; &quot;c&quot;</ui-text>'
    );
    expect(html).toContain('<ui-text data-link-id="u">it&#39;s</ui-text>');
    expect(html).toContain('src="x.png?a=1&amp;b=&quot;2&quot;"');
    expect(html).toContain('alt="&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(html).toContain('variant="&quot;&gt;&lt;script&gt;"');
    expect(html.includes('<script')).toBe(false);
  });

  it('never writes on* attributes or <script>, even from a custom kind', () => {
    const kinds = {
      text: {
        tag: 'ui-text',
        create(el, ctx) {
          const node = ctx.document.createElement('ui-text');
          node.setAttribute('onclick', 'alert(1)');
          node.setAttribute('ONLOAD', 'alert(2)');
          node.appendChild(ctx.document.createElement('script'));
          node.appendChild(ctx.document.createTextNode('safe'));
          return node;
        },
      },
    };
    const html = renderToHTML("(t: text 'x')", { kinds });
    expect(html).toBe('<ui-text data-link-id="t">safe</ui-text>');
  });

  it('renders unknown kinds as ui-unknown and reports them', () => {
    const codes = [];
    const html = renderToHTML("(w: widget (child: text 'in'))", {
      onDiagnostic: (d) => codes.push(d.code),
    });
    expect(html).toBe(
      '<ui-unknown data-kind="widget" data-link-id="w"><ui-text data-link-id="child">in</ui-text></ui-unknown>'
    );
    expect(codes).toContain('unknown-kind');
  });

  it('writes void elements without an end tag', () => {
    expect(renderToHTML("(i: image 'a.png' (alt 'A'))")).toBe(
      '<ui-image data-link-id="i"><img src="a.png" alt="A"></ui-image>'
    );
  });
});

describe('static template lookup', () => {
  it('finds nested attribute parts and preserves their serialized output', () => {
    const doc = createStaticDocument();
    const root = doc.createElement('button');
    const wrapper = doc.createElement('span');
    const label = doc.createElement('span');
    label.setAttribute('data-part', 'label');
    wrapper.appendChild(label);
    root.appendChild(wrapper);
    expect(root.querySelector('[data-part="label"]')).toBe(label);
    expect(root.querySelector('[data-part]')).toBe(label);
    expect(root.querySelector('[data-part="icon"]')).toBe(null);
    expect(root.querySelector('span')).toBe(wrapper);
  });
});
