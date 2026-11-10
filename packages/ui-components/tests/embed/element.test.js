import { describe, it, expect } from 'test-anywhere';
import { mountDocument, renderToHTML } from '@link-foundation/ui-dom';
import { defineEmbedElement, embedVocabulary } from '../../src/embed/index.js';
import { registerEmbedProvider } from '../../src/embed/registry.js';
import { createDom, microtasks } from '../support/dom.js';

const text = `post: embed
  provider test
  id 42
  enabled false
  toggle true
  archive: text 'Archived post'`;

describe('embed element and LiNo kind', () => {
  it('projects archived children and keeps the renderer store identity separate from the post id', async () => {
    const { window, container } = createDom();
    defineEmbedElement(window);
    const mounted = mountDocument(container, text, {
      parseOptions: { vocabulary: embedVocabulary() },
    });
    expect(mounted.diagnostics).toEqual([]);
    const host = mounted.handle.nodeFor('post');
    expect(host.getAttribute('id')).toBe('42');
    expect(host.getAttribute('data-link-id')).toBe('post');
    expect(host.querySelector('[slot="fallback"]').textContent).toBe(
      'Archived post'
    );
    expect(host.dataset.state).toBe('off');
    mounted.store.setProp('post', 'locale', ['ru']);
    mounted.handle.flush();
    await microtasks();
    expect(host.querySelector('button').textContent).toBe(
      'Показать публикацию'
    );
    mounted.handle.destroy();
    expect(host.querySelector('[data-part="embed"]')).toBe(null);
    window.close();
  });

  it('standalone elements dispose on disconnect and can reconnect', async () => {
    const { window, document } = createDom();
    const remove = registerEmbedProvider('test', {
      script: null,
      validate: () => true,
      url: () => 'https://example.com',
      render: (node, context) => context.ready(),
    });
    defineEmbedElement(window);
    const host = document.createElement('ui-embed');
    host.setAttribute('provider', 'test');
    host.setAttribute('id', '42');
    host.innerHTML = '<p slot="fallback">Archive</p>';
    document.body.append(host);
    await microtasks();
    expect(host.dataset.state).toBe('ready');
    host.remove();
    expect(host.querySelector('[data-part="embed"]')).toBe(null);
    document.body.append(host);
    await microtasks();
    expect(host.dataset.state).toBe('ready');
    host.remove();
    remove();
    window.close();
  });

  it('renders static archive HTML without provider scripts', () => {
    const result = renderToHTML(text, {
      parseOptions: { vocabulary: embedVocabulary() },
    });
    expect(result.includes('Archived post')).toBe(true);
    expect(result.includes('<script')).toBe(false);
  });
});
