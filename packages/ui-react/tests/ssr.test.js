/**
 * Server rendering: `renderToString(<UiView>)` runs with no DOM globals,
 * and `ssr` inlines the static HTML of ui-dom `renderToHTML`, which the
 * client replaces with live nodes on mount.
 *
 * This file imports the jsdom setup only after the server part, so the
 * server part runs with no `window` and no `document`.
 */

import { describe, it, expect } from 'test-anywhere';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { createStore } from '@link-foundation/ui-store';
import {
  UiProvider,
  UiView,
  renderViewToHTML,
  useUiProp,
} from '@link-foundation/ui-react';

const DOC =
  "(app: document (body: stack (greeting: text 'Hello <b>') (ok: button (label 'OK') (on press (emit save))) (c: chart (series 1 2))))";

function Greeting() {
  return h('p', null, useUiProp('greeting', 'value'));
}

describe('server rendering', () => {
  it('renders without window or document', () => {
    expect(typeof globalThis.window).toBe('undefined');
    expect(typeof globalThis.document).toBe('undefined');
    const html = renderToString(h(UiView, { source: DOC, className: 'x' }));
    expect(html).toBe('<div class="x" data-ui-root=""></div>');
  });

  it('inlines the static HTML with ssr', () => {
    const html = renderToString(h(UiView, { source: DOC, ssr: true }));
    expect(html).toContain('data-link-id="ok"');
    expect(html).toContain('<ui-button');
    expect(html).toContain('Hello &lt;b&gt;');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('onclick');
  });

  it('renders component kinds as empty hosts with ssr', () => {
    const html = renderToString(
      h(UiView, { source: DOC, ssr: true, components: { chart: () => null } })
    );
    expect(html).toContain(
      '<ui-react-host data-kind="chart" data-link-id="c">'
    );
  });

  it('runs the hooks with the server snapshot', () => {
    const store = createStore({ text: DOC });
    const html = renderToString(h(UiProvider, { store }, h(Greeting)));
    expect(html).toBe('<p>Hello &lt;b&gt;</p>');
    expect(renderViewToHTML(store)).toContain('data-link-id="greeting"');
  });
});

describe('client mount after ssr', () => {
  it('replaces the server HTML with live nodes', async () => {
    const serverHtml = renderToString(h(UiView, { source: DOC, ssr: true }));
    const { act } = await import('./setup-dom.js');
    const { hydrateRoot } = await import('react-dom/client');
    const { document } = globalThis;
    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    const serverButton = container.querySelector('[data-link-id="ok"]');
    const errors = [];
    const actions = [];
    let root;
    await act(async () => {
      root = hydrateRoot(
        container,
        h(UiView, {
          source: DOC,
          ssr: true,
          actions: { save: (d) => actions.push(d.source) },
        }),
        { onRecoverableError: (error) => errors.push(error) }
      );
    });
    expect(errors).toEqual([]);
    const live = container.querySelector('[data-link-id="ok"]');
    expect(live).not.toBe(serverButton);
    expect(container.querySelectorAll('[data-link-id="ok"]').length).toBe(1);
    await act(async () => live.querySelector('button').click());
    expect(actions).toEqual(['ok']);
    await act(async () => root.unmount());
  });
});
