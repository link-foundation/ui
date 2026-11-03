/**
 * The DOM-free hooks re-render a component only when its own slice of the
 * store changes.
 */

import { describe, it, expect } from 'test-anywhere';
import { createStore } from '@link-foundation/ui-store';
import {
  UiProvider,
  useUiAction,
  useUiContext,
  useUiElement,
  useUiProp,
  useUiProps,
  useUiStore,
} from '@link-foundation/ui-react/hooks';
import { change, h, mount, sample } from './setup-dom.js';

/** A component that records each render's value of `use()`. */
function probe(use) {
  const seen = [];
  function Probe() {
    seen.push(use());
    return null;
  }
  return { seen, Probe };
}

const provided = (store, element) => h(UiProvider, { store }, element);

describe('useUiProp', () => {
  it("re-renders only when greeting's text changes", async () => {
    const store = createStore({ text: sample('document') });
    const { seen, Probe } = probe(() => useUiProp('greeting', 'text'));
    const view = await mount(provided(store, h(Probe)));
    expect(seen).toEqual([undefined]);

    await change(() => store.setProp('greeting', 'text', ['Hi']));
    expect(seen).toEqual([undefined, ['Hi']]);

    // Another element, another property of greeting, the same value again.
    await change(() => store.setProp('ok', 'label', ['Save']));
    await change(() => store.setProp('greeting', 'variant', ['title']));
    await change(() => store.setProp('greeting', 'text', ['Hi']));
    expect(seen.length).toBe(2);

    await change(() => store.setProp('greeting', 'text', ['Hello again']));
    expect(seen.at(-1)).toEqual(['Hello again']);
    expect(seen.length).toBe(3);
    await view.unmount();
  });

  it('names positional values by the vocabulary (text → value)', async () => {
    const store = createStore({ text: sample('document') });
    const { seen, Probe } = probe(() => useUiProp('greeting', 'value'));
    const view = await mount(provided(store, h(Probe)));
    expect(seen).toEqual([['Hello, links']]);
    await change(() => store.setProp('ok', 'label', ['Save']));
    expect(seen.length).toBe(1);
    await change(() => store.setPositional('greeting', ['Hi']));
    expect(seen).toEqual([['Hello, links'], ['Hi']]);
    // A named property wins over the positional value.
    await change(() => store.setProp('greeting', 'value', ['Named']));
    expect(seen.at(-1)).toEqual(['Named']);
    await view.unmount();
  });
});

describe('useUiElement and useUiProps', () => {
  it('re-render only when the element changes', async () => {
    const store = createStore({ text: sample('document') });
    const element = probe(() => useUiElement('ok'));
    const props = probe(() => useUiProps('ok'));
    const view = await mount(
      provided(store, [
        h(element.Probe, { key: 'e' }),
        h(props.Probe, { key: 'p' }),
      ])
    );
    expect(element.seen[0].kind).toBe('button');
    expect(props.seen[0].label).toEqual(['OK']);
    await change(() => store.setProp('greeting', 'value', ['x']));
    expect(element.seen.length).toBe(1);
    expect(props.seen.length).toBe(1);
    await change(() => store.setProp('ok', 'label', ['Save']));
    expect(element.seen.length).toBe(2);
    expect(props.seen.at(-1).label).toEqual(['Save']);
    await change(() => store.remove('ok'));
    expect(element.seen.at(-1)).toBe(undefined);
    expect(props.seen.at(-1)).toBe(undefined);
    await view.unmount();
  });
});

describe('useUiStore', () => {
  it('takes a store argument and an equality function', async () => {
    const store = createStore({ text: sample('document') });
    const { seen, Probe } = probe(() =>
      useUiStore(
        store,
        (s) => s.children('body'),
        (a, b) => a.length === b.length && a.every((id, i) => id === b[i])
      )
    );
    const view = await mount(h(Probe));
    expect(seen).toEqual([['greeting', 'ok']]);
    await change(() => store.setProp('ok', 'label', ['Save']));
    expect(seen.length).toBe(1);
    await change(() => store.remove('greeting'));
    expect(seen.at(-1)).toEqual(['ok']);
    await view.unmount();
  });

  it('throws a clear error without a store', async () => {
    const { Probe } = probe(() => useUiProp('greeting', 'value'));
    let error = null;
    const original = console.error;
    console.error = () => {};
    try {
      await mount(h(Probe));
    } catch (e) {
      error = e;
    } finally {
      console.error = original;
    }
    expect(String(error?.message)).toContain('no store');
  });
});

describe('useUiAction and the provider', () => {
  it('registers a handler while mounted and unregisters on unmount', async () => {
    const store = createStore({ text: sample('document') });
    const calls = [];
    let registry = null;
    function Handler() {
      useUiAction('save', (detail) => calls.push(detail.source));
      registry = useUiContext().registry;
      return null;
    }
    const view = await mount(provided(store, h(Handler)));
    const detail = { source: 'ok', event: 'press', action: ['emit', 'save'] };
    expect(registry.dispatch(detail)).toBe(true);
    expect(calls).toEqual(['ok']);
    await view.rerender(provided(store, null));
    expect(registry.lookup(['emit', 'save'])).toBe(undefined);
    await view.unmount();
  });
});
