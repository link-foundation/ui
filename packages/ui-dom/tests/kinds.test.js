/**
 * The kind registry, the custom element definitions, and the basic kinds.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  defineKind,
  getKind,
  isCustomElementName,
  mountDocument,
  registeredKinds,
} from '@link-foundation/ui-dom';
import { createDom } from './setup-dom.js';

function mount(text, options = {}) {
  const dom = createDom();
  const codes = [];
  const mounted = mountDocument(dom.container, text, {
    onDiagnostic: (d) => codes.push(d.code),
    ...options,
  });
  return { ...dom, ...mounted, codes };
}

describe('kind registry', () => {
  it('registers the basic kinds', () => {
    for (const kind of ['document', 'stack', 'text', 'button', 'image']) {
      expect(registeredKinds()).toContain(kind);
      expect(getKind(kind).tag).toBe(`ui-${kind}`);
    }
    expect(getKind('widget')).toBeUndefined();
    expect(getKind(null)).toBeUndefined();
  });

  it('validates kind specs', () => {
    const create = () => null;
    expect(() => defineKind('', { tag: 'ui-x', create })).toThrow('kind');
    expect(() => defineKind('x', { tag: 'x', create })).toThrow(
      'custom element name'
    );
    expect(() => defineKind('x', { tag: 'Ui-X', create })).toThrow(
      'custom element name'
    );
    expect(() => defineKind('x', { tag: 'ui-x' })).toThrow('create');
    expect(() =>
      defineKind('x', { tag: 'ui-x', create, childrenSlot: 'slot' })
    ).toThrow('childrenSlot');
    expect(() =>
      defineKind('x', {
        tag: 'ui-x',
        create,
        attributes: { onclick: 'string' },
      })
    ).toThrow('on*');
    expect(isCustomElementName('ui-a.b_c-1')).toBe(true);
    expect(isCustomElementName('ui')).toBe(false);
  });

  it('renders a kind defined with defineKind', () => {
    // `asset` is a vocabulary kind without a basic DOM renderer.
    defineKind('asset', {
      tag: 'ui-asset',
      attributes: { license: 'string' },
      create: (el, ctx) => ctx.document.createElement('ui-asset'),
    });
    const { handle, window } = mount("(n: asset (license 'CC0-1.0'))");
    const node = handle.nodeFor('n');
    expect(node.localName).toBe('ui-asset');
    expect(node.getAttribute('license')).toBe('CC0-1.0');
    expect(node instanceof window.HTMLElement).toBe(true);
    expect(window.customElements.get('ui-asset')).toBeTruthy();
  });

  it('defines a tag only when customElements.get(tag) is undefined', () => {
    const { window, container } = createDom();
    const defined = [];
    const define = window.customElements.define.bind(window.customElements);
    window.customElements.define = (tag, ctor) => {
      defined.push(tag);
      define(tag, ctor);
    };
    // A page-defined ui-text is kept.
    class PageText extends window.HTMLElement {}
    define('ui-text', PageText);
    const text = "(s: stack (a: text 'a') (b: text 'b') (c: button 'C'))";
    const first = mountDocument(container, text);
    expect(defined).toEqual(['ui-stack', 'ui-button']);
    expect(first.handle.nodeFor('a') instanceof PageText).toBe(true);
    first.handle.destroy();
    mountDocument(container, text);
    expect(defined).toEqual(['ui-stack', 'ui-button']);
  });

  it('prefers the kinds option over the registry', () => {
    const { handle } = mount("(t: text 'x')", {
      kinds: new Map([
        [
          'text',
          {
            tag: 'my-text',
            create: (el, ctx) => ctx.document.createElement('my-text'),
          },
        ],
      ]),
    });
    expect(handle.nodeFor('t').localName).toBe('my-text');
  });
});

describe('unknown kinds', () => {
  it('render ui-unknown with data-kind and a diagnostic, never throwing', () => {
    const { handle, codes, diagnostics } = mount(
      "(w: widget (size 3) (inner: text 'kept'))"
    );
    const node = handle.nodeFor('w');
    expect(node.localName).toBe('ui-unknown');
    expect(node.getAttribute('data-kind')).toBe('widget');
    expect(handle.nodeFor('inner').parentNode).toBe(node);
    expect(codes).toContain('unknown-kind');
    const found = diagnostics.find((d) => d.code === 'unknown-kind');
    expect(found.at).toEqual({ element: 'w', kind: 'widget' });
    expect(found.message).toContain('widget');
  });

  it('fall back to ui-unknown when a kind renderer throws', () => {
    const { handle, codes } = mount("(t: text 'x')", {
      kinds: {
        text: {
          tag: 'ui-text',
          create() {
            throw new Error('boom');
          },
        },
      },
    });
    expect(handle.nodeFor('t').localName).toBe('ui-unknown');
    expect(codes).toContain('kind-error');
  });

  it('report a failing update without stopping the render', () => {
    const { handle, codes } = mount("(s: stack (t: text 'x'))", {
      kinds: {
        stack: {
          tag: 'ui-stack',
          create: (el, ctx) => ctx.document.createElement('ui-stack'),
          update() {
            throw new Error('boom');
          },
        },
      },
    });
    expect(codes).toContain('kind-error');
    expect(handle.nodeFor('t').textContent).toBe('x');
  });
});

describe('basic kinds', () => {
  it('stack: direction and gap as flex-direction and gap', () => {
    const { handle, store, codes } = mount(
      '(s: stack (direction horizontal) (gap 8px) (padding 4px 8px) (align center))'
    );
    const node = handle.nodeFor('s');
    expect(node.style.getPropertyValue('flex-direction')).toBe('row');
    expect(node.style.getPropertyValue('gap')).toBe('8px');
    expect(node.style.getPropertyValue('padding')).toBe('4px 8px');
    expect(node.getAttribute('align')).toBe('center');
    expect(node.getAttribute('direction')).toBe('horizontal');
    store.setProp('s', 'gap', ['(url evil)']);
    store.removeProp('s', 'direction');
    handle.flush();
    expect(node.style.getPropertyValue('gap')).toBe('');
    expect(node.style.getPropertyValue('flex-direction')).toBe('');
    expect(node.hasAttribute('direction')).toBe(false);
    expect(codes).toContain('invalid-value');
  });

  it('text: a Text node, never markup', () => {
    const { handle } = mount("(t: text '<b>bold</b>')");
    const node = handle.nodeFor('t');
    expect(node.children.length).toBe(0);
    expect(node.textContent).toBe('<b>bold</b>');
  });

  it('button: native button, label, variant attribute and disabled', () => {
    const { handle, store } = mount(
      "(b: button 'Save' (variant outlined) (disabled true))"
    );
    const node = handle.nodeFor('b');
    const button = node.firstElementChild;
    expect(button.localName).toBe('button');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.textContent).toBe('Save');
    expect(node.getAttribute('variant')).toBe('outlined');
    expect(node.hasAttribute('disabled')).toBe(true);
    expect(button.disabled).toBe(true);
    store.setProp('b', 'disabled', ['false']);
    store.setProp('b', 'label', ['Saved']);
    handle.flush();
    expect(node.hasAttribute('disabled')).toBe(false);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Saved');
  });

  it('image: src and alt; a missing alt gives alt="" and a diagnostic', () => {
    const { handle, codes, store } = mount(
      "(s: stack (a: image 'a.png' (alt 'A cat') (width 40)) (b: image 'b.png'))"
    );
    const a = handle.nodeFor('a').querySelector('img');
    expect(a.getAttribute('src')).toBe('a.png');
    expect(a.getAttribute('alt')).toBe('A cat');
    expect(a.getAttribute('width')).toBe('40');
    const b = handle.nodeFor('b').querySelector('img');
    expect(b.getAttribute('alt')).toBe('');
    expect(codes.filter((c) => c === 'missing-alt').length).toBe(1);
    store.removeProp('a', 'alt');
    handle.flush();
    expect(a.getAttribute('alt')).toBe('');
    expect(codes.filter((c) => c === 'missing-alt').length).toBe(2);
  });

  it('image: unsafe URLs are not loaded', () => {
    for (const url of [
      'javascript:alert(1)',
      ' JavaScript:x',
      'data:text/html,x',
      'vbscript:x',
      'java\tscript:x',
    ]) {
      const { handle, codes } = mount(`(i: image '${url}' (alt x))`);
      expect(handle.nodeFor('i').querySelector('img').hasAttribute('src')).toBe(
        false
      );
      expect(codes).toContain('unsafe-url');
    }
  });

  it('document: theme and lang attributes', () => {
    const { handle } = mount('(d: document (theme dark) (lang en))');
    const node = handle.nodeFor('d');
    expect(node.getAttribute('theme')).toBe('dark');
    expect(node.getAttribute('lang')).toBe('en');
  });

  it('a text with children keeps them detached but mapped', () => {
    const { handle, store } = mount("(t: text 'x' (c: text 'y'))");
    expect(handle.nodeFor('t').children.length).toBe(0);
    expect(handle.idFor(handle.nodeFor('c'))).toBe('c');
    expect(store.children('t')).toEqual(['c']);
  });
});
