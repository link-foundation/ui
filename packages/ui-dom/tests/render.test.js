/**
 * render / mountDocument: the issue-1 sample as custom elements, the ID
 * maps, and destroy.
 */

import { describe, it, expect } from 'test-anywhere';
import { mountDocument, render } from '@link-foundation/ui-dom';
import {
  countedStore,
  createDom,
  sample,
  snapshot,
  storeIds,
} from './setup-dom.js';

const tagsOf = (node) => [...node.children].map((child) => child.localName);

describe('render', () => {
  it('renders the sample as ui-document > ui-stack > (ui-text, ui-button)', () => {
    const { container } = createDom();
    mountDocument(container, sample('document'));
    expect(tagsOf(container)).toEqual(['ui-document']);
    const documentNode = container.firstElementChild;
    expect(tagsOf(documentNode)).toEqual(['ui-stack']);
    expect(tagsOf(documentNode.firstElementChild)).toEqual([
      'ui-text',
      'ui-button',
    ]);
  });

  it('matches the snapshot', () => {
    const { container } = createDom();
    mountDocument(container, sample('document'));
    const html = `${container.innerHTML}\n`;
    expect(html).toBe(snapshot('document.html', html));
  });

  it('maps every store ID to its node and back', () => {
    const { container } = createDom();
    const { store, handle } = mountDocument(container, sample('document'));
    const ids = storeIds(store);
    expect(ids).toEqual(['app', 'body', 'greeting', 'ok']);
    for (const id of ids) {
      const node = handle.nodeFor(id);
      expect(node.getAttribute('data-link-id')).toBe(id);
      expect(handle.idFor(node)).toBe(id);
    }
    // Inner nodes belong to their element; unknown IDs have no node.
    expect(handle.idFor(handle.nodeFor('ok').firstChild)).toBe('ok');
    expect(handle.idFor(container)).toBeNull();
    expect(handle.nodeFor('missing')).toBeNull();
  });

  it('gives anonymous elements their generated store IDs', () => {
    const { container } = createDom();
    const { store, handle } = mountDocument(
      container,
      "(stack (text 'a') (text 'b'))"
    );
    const ids = storeIds(store);
    expect(ids.length).toBe(3);
    for (const id of ids) {
      expect(handle.idFor(handle.nodeFor(id))).toBe(id);
    }
    expect(container.querySelectorAll('[data-link-id]').length).toBe(3);
  });

  it('labels the native button and renders the text as text', () => {
    const { container } = createDom();
    const { handle } = mountDocument(container, sample('document'));
    const button = handle.nodeFor('ok').querySelector('button');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.textContent).toBe('OK');
    expect(handle.nodeFor('ok').getAttribute('variant')).toBe('filled');
    expect(handle.nodeFor('greeting').textContent).toBe('Hello, links');
    expect(
      handle.nodeFor('body').style.getPropertyValue('flex-direction')
    ).toBe('column');
    expect(handle.nodeFor('body').style.getPropertyValue('gap')).toBe(
      'var(--space-medium)'
    );
  });

  it('sets the document title only with setTitle', () => {
    const plain = createDom();
    mountDocument(plain.container, sample('document'));
    expect(plain.document.title).toBe('');
    const titled = createDom();
    mountDocument(titled.container, sample('document'), { setTitle: true });
    expect(titled.document.title).toBe('Links UI demo');
  });

  it('returns the parse and render diagnostics from mountDocument', () => {
    const { container } = createDom();
    const seen = [];
    const { diagnostics } = mountDocument(container, '(x: widget)', {
      onDiagnostic: (d) => seen.push(d.code),
    });
    expect(diagnostics.map((d) => d.code)).toContain('unknown-kind');
    expect(seen).toContain('unknown-kind');
  });

  it('destroy removes every node and the store listener', () => {
    const { container } = createDom();
    const store = countedStore(sample('document'));
    const destroyed = [];
    const handle = render(container, store, {
      kinds: {
        text: {
          tag: 'ui-text',
          create: (el, ctx) => ctx.document.createElement('ui-text'),
          destroy: (node) => destroyed.push(node.getAttribute('data-link-id')),
        },
      },
    });
    expect(store.listenerCount()).toBe(1);
    handle.destroy();
    expect(store.listenerCount()).toBe(0);
    expect(container.children.length).toBe(0);
    expect(destroyed).toEqual(['greeting']);
    for (const id of storeIds(store)) {
      expect(handle.nodeFor(id)).toBeNull();
    }
    // Later store changes do not reach the container; destroy is idempotent.
    store.setProp('greeting', 'value', ['Hi']);
    expect(handle.flush()).toBe(0);
    handle.destroy();
    expect(container.children.length).toBe(0);
  });
});
