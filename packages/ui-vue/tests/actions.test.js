/**
 * Actions: the `action` emit with the ui-dom `ui-action` detail, the
 * `actions` prop, `useUiAction` and the plugin registry, and the warning for
 * actions nobody handles.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  TestUtils,
  UiVue,
  Vue,
  container,
  sample,
  useDom,
} from './setup-dom.js';

const { defineComponent, h } = Vue;
const { mount } = TestUtils;
const { UiView, actionNames, createUiPlugin, useUiAction } = UiVue;

useDom();

const SAVE = "(app: document (ok: button (label 'OK') (on press (emit save))))";

/** Collect the `console.warn` calls of `fn`. */
async function warnings(fn) {
  const calls = [];
  const original = console.warn;
  console.warn = (...args) => calls.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.warn = original;
  }
  return calls;
}

/** Click the native button inside `ui-button[data-link-id=ID]`. */
const click = (wrapper, id) =>
  wrapper.find(`[data-link-id="${id}"] button`).element.click();

describe('UiView actions', () => {
  it('emits action with the ui-action detail and calls the handler once', () => {
    const calls = [];
    const wrapper = mount(UiView, {
      props: {
        source: sample('document'),
        actions: { navigate: (detail) => calls.push(detail) },
      },
      attachTo: container(),
    });
    click(wrapper, 'ok');
    const emitted = wrapper.emitted('action');
    expect(emitted.length).toBe(1);
    expect(emitted[0][0]).toEqual({
      source: 'ok',
      event: 'press',
      action: ['navigate', 'home'],
    });
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe(emitted[0][0]);
    wrapper.unmount();
  });

  it('calls actions.save once for (emit save)', () => {
    let saves = 0;
    let emits = 0;
    const wrapper = mount(UiView, {
      props: {
        source: SAVE,
        actions: { save: () => (saves += 1), emit: () => (emits += 1) },
      },
      attachTo: container(),
    });
    click(wrapper, 'ok');
    expect(saves).toBe(1);
    // The most specific handler wins.
    expect(emits).toBe(0);
    wrapper.unmount();
  });

  it('accepts a Map of handlers', () => {
    let saves = 0;
    const wrapper = mount(UiView, {
      props: { source: SAVE, actions: new Map([['save', () => (saves += 1)]]) },
      attachTo: container(),
    });
    click(wrapper, 'ok');
    expect(saves).toBe(1);
    wrapper.unmount();
  });

  it('only warns, one time per name, for an unhandled action', async () => {
    const calls = await warnings(() => {
      const wrapper = mount(UiView, {
        props: { source: SAVE },
        attachTo: container(),
      });
      click(wrapper, 'ok');
      click(wrapper, 'ok');
      expect(wrapper.emitted('action').length).toBe(2);
      wrapper.unmount();
    });
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain('"save"');
  });

  it('only warns for an action head outside the vocabulary', async () => {
    const source =
      "(app: document (ok: button (label 'OK') (on press (save) (emit save))))";
    let saves = 0;
    const calls = await warnings(() => {
      const wrapper = mount(UiView, {
        props: { source, actions: { save: () => (saves += 1) } },
        attachTo: container(),
      });
      click(wrapper, 'ok');
      wrapper.unmount();
    });
    // `(save)` is ignored with a warning; `(emit save)` still runs.
    expect(saves).toBe(1);
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain('(emit save)');
  });

  it('calls the handlers of the plugin and of useUiAction', () => {
    const seen = [];
    const Child = defineComponent({
      props: { id: String },
      setup(props) {
        useUiAction('save', (detail) => seen.push(`child:${detail.source}`));
        return () => h('span', props.id);
      },
    });
    const source =
      "(app: document (ok: button 'OK' (on press (emit save) (navigate home))) (box: panel))";
    const wrapper = mount(UiView, {
      props: { source, components: { panel: Child } },
      global: {
        plugins: [
          createUiPlugin({
            actions: {
              save: () => seen.push('plugin:save'),
              navigate: (detail) => seen.push(`plugin:${detail.action[1]}`),
            },
          }),
        ],
      },
      attachTo: container(),
    });
    // The component mounts after the view: its handler is not there yet.
    click(wrapper, 'ok');
    expect(seen).toEqual(['plugin:save', 'plugin:home']);
    seen.length = 0;
    return Vue.nextTick().then(() => {
      click(wrapper, 'ok');
      // The view's own registry comes before the plugin's.
      expect(seen).toEqual(['child:ok', 'plugin:home']);
      wrapper.unmount();
    });
  });

  it('maps an action to its handler names', () => {
    expect(actionNames(['emit', 'save'])).toEqual(['save', 'emit']);
    expect(actionNames(['navigate', 'home'])).toEqual(['navigate']);
    expect(actionNames(['emit'])).toEqual(['emit']);
  });
});
