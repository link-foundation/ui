/**
 * `<UiView source>` mounts ui-dom into `<div data-ui-root>`; store changes
 * are patched by ui-dom without re-rendering the React component.
 */

import { describe, it, expect } from 'test-anywhere';
import { Profiler } from 'react';
import { createStore } from '@link-foundation/ui-store';
import { UiProvider, UiView } from '@link-foundation/ui-react';
import { change, h, mount, sample } from './setup-dom.js';

const SAVE_DOC =
  "(app: document (body: stack (ok: button (label 'OK') (on press (emit save)))))";

/** Count the commits of a subtree. */
function counted(element) {
  const counter = { renders: 0 };
  const tree = h(
    Profiler,
    { id: 'view', onRender: () => (counter.renders += 1) },
    element
  );
  return { counter, tree };
}

describe('UiView document', () => {
  it('renders ui-button with data-link-id="ok" inside the container', async () => {
    const view = await mount(h(UiView, { source: SAVE_DOC }));
    const root = view.container.querySelector('div[data-ui-root]');
    expect(root).not.toBe(null);
    const button = root.querySelector('ui-button[data-link-id="ok"]');
    expect(button).not.toBe(null);
    expect(button.textContent).toBe('OK');
    await view.unmount();
  });

  it('renders the issue-1 sample document', async () => {
    const view = await mount(
      h(UiView, { source: sample('document'), className: 'demo' })
    );
    const root = view.container.firstChild;
    expect(root.className).toBe('demo');
    expect(
      root.querySelector('ui-text[data-link-id="greeting"]').textContent
    ).toBe('Hello, links');
    expect(root.querySelector('ui-button[data-link-id="ok"]')).not.toBe(null);
    await view.unmount();
    expect(view.container.isConnected).toBe(false);
  });

  it('updates the DOM on a store change without re-rendering UiView', async () => {
    const store = createStore({ text: sample('document') });
    const { counter, tree } = counted(h(UiView, { store }));
    const view = await mount(tree);
    expect(counter.renders).toBe(1);
    const greeting = view.container.querySelector('[data-link-id="greeting"]');
    await change(() => store.setProp('greeting', 'value', ['Hi, React']));
    expect(greeting.textContent).toBe('Hi, React');
    await change(() => store.setProp('ok', 'label', ['Save']));
    expect(
      view.container.querySelector('[data-link-id="ok"]').textContent
    ).toBe('Save');
    expect(counter.renders).toBe(1);
    await view.unmount();
  });

  it('takes the store of a provider and parses a source only once', async () => {
    const store = createStore({ text: SAVE_DOC });
    const view = await mount(
      h(UiProvider, { store }, h(UiView, { className: 'a' }))
    );
    expect(view.container.querySelector('[data-link-id="ok"]')).not.toBe(null);
    await view.unmount();

    const handle = { current: null };
    const first = await mount(
      h(UiView, { source: SAVE_DOC, handleRef: handle })
    );
    const before = handle.current.store;
    await first.rerender(
      h(UiView, { source: SAVE_DOC, handleRef: handle, className: 'b' })
    );
    expect(handle.current.store).toBe(before);
    await first.unmount();
    expect(handle.current).toBe(null);
  });

  it('reports parse diagnostics and throws without a store', async () => {
    const codes = [];
    const view = await mount(
      h(UiView, {
        source: "(app: document (x: nonsense 'a'))",
        onDiagnostic: (d) => codes.push(d.code),
      })
    );
    expect(codes.includes('unknown-kind')).toBe(true);
    await view.unmount();
    expect(() => UiView({})).toThrow();
  });
});
