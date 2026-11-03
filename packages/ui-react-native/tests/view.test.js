import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createElement, StrictMode } from 'react';
import { create, act } from 'react-test-renderer';
import { createStore } from '@link-foundation/ui-store';
import { createUiNativeView } from '../src/UiNativeView.js';
import { primitives, UiNativeView } from './fake-primitives.js';

describe('UiNativeView', () => {
  it('re-renders only greeting when its property changes', async () => {
    const renders = {};
    const counted = Object.fromEntries(
      Object.keys(primitives).map((name) => [
        name,
        (props) => {
          if (props.testID) {
            renders[props.testID] = (renders[props.testID] ?? 0) + 1;
          }
          return createElement(name, props);
        },
      ])
    );
    const View = createUiNativeView(counted);
    const store = createStore({
      text: 'app: document (body: stack (greeting: text Hello) (ok: button (label OK)))',
    });
    let root;
    await act(() => {
      root = create(createElement(View, { store }));
    });
    assert.deepEqual(renders, { app: 1, body: 1, greeting: 1, ok: 1 });
    await act(() => store.setProp('greeting', 'value', ['Changed']));
    assert.deepEqual(renders, { app: 1, body: 1, greeting: 2, ok: 1 });
    assert.equal(
      root.root.findByProps({ testID: 'greeting' }).props.children,
      'Changed'
    );
    await act(() => root.unmount());
  });
  it('reflects insert, move, rename, remove and root changes', async () => {
    const store = createStore({ text: 'app: document (body: stack)' });
    let root;
    await act(() => {
      root = create(createElement(UiNativeView, { store }));
    });
    await act(() =>
      store.insert('body', 0, { id: 'new', kind: 'text', positional: ['New'] })
    );
    assert.equal(
      root.root.findByProps({ testID: 'new' }).props.children,
      'New'
    );
    await act(() => store.move('new', null));
    await act(() => store.rename('new', 'renamed'));
    assert.equal(root.toJSON()[1].props.testID, 'renamed');
    await act(() => store.remove('renamed'));
    assert.equal(root.toJSON().type, 'ScrollView');
    await act(() => root.unmount());
  });
  it('supports custom components, source replacement, StrictMode cleanup', async () => {
    const baseStore = createStore({ text: 'chart: chart' });
    const store = { ...baseStore };
    let listeners = 0;
    const subscribe = store.subscribe;
    store.subscribe = (fn) => {
      listeners++;
      const off = subscribe(fn);
      return () => {
        listeners--;
        off();
      };
    };
    const Chart = ({ id }) => createElement('Custom', { id });
    let root;
    await act(() => {
      root = create(
        createElement(
          StrictMode,
          null,
          createElement(UiNativeView, { store, components: { chart: Chart } })
        )
      );
    });
    assert.equal(root.root.findByType('Custom').props.id, 'chart');
    await act(() =>
      root.update(createElement(UiNativeView, { source: 'hello: text Hello' }))
    );
    assert.equal(root.toJSON().props.testID, 'hello');
    await act(() =>
      root.update(createElement(UiNativeView, { source: 'bye: text Bye' }))
    );
    assert.equal(root.toJSON().children[0], 'Bye');
    await act(() => root.unmount());
    assert.equal(listeners, 0);
  });
});
