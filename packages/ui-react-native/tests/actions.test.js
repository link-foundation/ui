import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { create, act } from 'react-test-renderer';
import { UiProvider, useUiAction } from '@link-foundation/ui-react/hooks';
import { createStore } from '@link-foundation/ui-store';
import { UiNativeView } from './fake-primitives.js';

describe('native actions', () => {
  it('dispatches the F16 detail and never evaluates action data', async () => {
    const details = [],
      handled = [];
    let executed = false;
    globalThis.alert = () => {
      executed = true;
    };
    let root;
    await act(() => {
      root = create(
        createElement(UiNativeView, {
          source:
            "ok: button (label OK) (on press (navigate home) (emit save 'alert(1)'))",
          onAction: (detail) => details.push(detail),
          actions: {
            navigate: (detail) => handled.push(detail),
            save: (detail) => handled.push(detail),
          },
        })
      );
    });
    await act(() =>
      root.root.findByType('Pressable').props.onPress({ nativeEvent: {} })
    );
    assert.deepEqual(details[0], {
      source: 'ok',
      event: 'press',
      action: ['navigate', 'home'],
    });
    assert.deepEqual(handled, details);
    assert.equal(executed, false);
    delete globalThis.alert;
    await act(() => root.unmount());
  });
  it('uses provider and hook actions and ignores disabled presses', async () => {
    const store = createStore({
      text: 'ok: button (label OK) (on press (emit save))',
    });
    let calls = 0;
    function Host() {
      useUiAction('save', () => calls++);
      return createElement(UiNativeView, {});
    }
    let root;
    await act(() => {
      root = create(createElement(UiProvider, { store }, createElement(Host)));
    });
    await act(() => root.root.findByType('Pressable').props.onPress());
    assert.equal(calls, 1);
    await act(() => store.setProp('ok', 'disabled', ['true']));
    await act(() => root.root.findByType('Pressable').props.onPress());
    assert.equal(calls, 1);
    await act(() => root.unmount());
  });
});
