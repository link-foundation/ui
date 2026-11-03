/**
 * `<StrictMode>` mounts, unmounts and mounts again: there is exactly one
 * rendered tree, and nothing stays subscribed after unmount.
 */

import { describe, it, expect } from 'test-anywhere';
import { StrictMode } from 'react';
import { UiProvider, UiView, useUiProp } from '@link-foundation/ui-react';
import { change, h, mount, sample, trackedStore } from './setup-dom.js';

const CHART_DOC =
  "(app: document (body: stack (c: chart (series 1 2)) (greeting: text 'Hi')))";

/**
 * The live listeners added on elements, counted by type; those of
 * `except` (the React root container, where React delegates events) are
 * left out.
 */
function trackListeners(target) {
  const live = new Map();
  const add = target.addEventListener;
  const remove = target.removeEventListener;
  target.addEventListener = function (type, listener, options) {
    live.set(listener, { type, target: this });
    return add.call(this, type, listener, options);
  };
  target.removeEventListener = function (type, listener, options) {
    live.delete(listener);
    return remove.call(this, type, listener, options);
  };
  return {
    count: (type, except) =>
      [...live.values()].filter((l) => l.type === type && l.target !== except)
        .length,
    restore() {
      target.addEventListener = add;
      target.removeEventListener = remove;
    },
  };
}

describe('StrictMode', () => {
  it('renders exactly one tree and leaks no store listener', async () => {
    const store = trackedStore(sample('document'));
    const proto = globalThis.window.HTMLElement.prototype;
    const listeners = trackListeners(proto);
    try {
      const view = await mount(h(StrictMode, null, h(UiView, { store })));
      expect(view.container.querySelectorAll('[data-ui-root]').length).toBe(1);
      expect(view.container.querySelectorAll('ui-document').length).toBe(1);
      expect(
        view.container.querySelectorAll('[data-link-id="ok"]').length
      ).toBe(1);
      // One ui-dom subscription and one rename watcher: the first mount's
      // were released by StrictMode's unmount.
      expect(store.listenerCount()).toBe(2);
      expect(listeners.count('ui-action', view.container)).toBe(1);
      expect(listeners.count('click', view.container)).toBe(1);

      await change(() => store.setProp('greeting', 'value', ['Strict']));
      expect(
        view.container.querySelector('[data-link-id="greeting"]').textContent
      ).toBe('Strict');

      await view.unmount();
      expect(store.listenerCount()).toBe(0);
      expect(listeners.count('ui-action', view.container)).toBe(0);
      expect(listeners.count('click', view.container)).toBe(0);
    } finally {
      listeners.restore();
    }
  });

  it('keeps one portal per host and releases hooks', async () => {
    const store = trackedStore(CHART_DOC);
    let mounted = 0;
    function Chart({ id }) {
      mounted += 1;
      return h('canvas', { 'data-chart': id });
    }
    function Greeting() {
      return h('p', { id: 'hooked' }, useUiProp('greeting', 'value'));
    }
    const view = await mount(
      h(
        StrictMode,
        null,
        h(
          UiProvider,
          { store },
          h(UiView, { components: { chart: Chart } }),
          h(Greeting)
        )
      )
    );
    expect(mounted > 0).toBe(true);
    expect(view.container.querySelectorAll('ui-react-host').length).toBe(1);
    expect(view.container.querySelectorAll('canvas').length).toBe(1);
    expect(view.container.querySelector('#hooked').textContent).toBe('Hi');
    await change(() => store.setProp('greeting', 'value', ['Again']));
    expect(view.container.querySelector('#hooked').textContent).toBe('Again');
    await view.unmount();
    expect(store.listenerCount()).toBe(0);
  });
});
