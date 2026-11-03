/**
 * createUiPlugin: the store and the action registry for the whole app.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  TestUtils,
  UiVue,
  Vue,
  container,
  countedStore,
  sample,
  tick,
  useDom,
} from './setup-dom.js';

const { defineComponent, h, inject, nextTick } = Vue;
const { mount } = TestUtils;
const {
  UI_ACTIONS_KEY,
  UI_STORE_KEY,
  UiView,
  createUiPlugin,
  useUiAction,
  useUiElement,
  useUiProp,
  useUiStore,
} = UiVue;

useDom();

describe('createUiPlugin', () => {
  it('lets composables inside a component find the provided store', async () => {
    const store = countedStore(sample('document'));
    const Greeting = defineComponent({
      setup() {
        const value = useUiProp('greeting', 'value');
        const ok = useUiElement('ok');
        const count = useUiStore((s) => s.children('body').length);
        return () =>
          h('p', `${value.value?.[0]} / ${ok.value?.kind} / ${count.value}`);
      },
    });
    const wrapper = mount(Greeting, {
      global: { plugins: [createUiPlugin({ store })] },
      attachTo: container(),
    });
    expect(wrapper.text()).toBe('Hello, links / button / 2');
    expect(store.listenerCount()).toBe(3);
    store.setProp('greeting', 'value', ['Hi']);
    await nextTick();
    expect(wrapper.text()).toBe('Hi / button / 2');
    wrapper.unmount();
    expect(store.listenerCount()).toBe(0);
  });

  it('provides the store to UiView and the registry under exported Symbol keys', () => {
    const store = countedStore(sample('document'));
    const plugin = createUiPlugin({ store, actions: { save: () => {} } });
    let provided;
    const Probe = defineComponent({
      setup() {
        provided = {
          store: inject(UI_STORE_KEY),
          registry: inject(UI_ACTIONS_KEY),
        };
        return () => h(UiView);
      },
    });
    expect(typeof UI_STORE_KEY).toBe('symbol');
    expect(typeof UI_ACTIONS_KEY).toBe('symbol');
    const wrapper = mount(Probe, {
      global: { plugins: [plugin] },
      attachTo: container(),
    });
    expect(provided.store).toBe(store);
    expect(provided.registry).toBe(plugin.registry);
    expect(provided.registry.handlers('save').length).toBe(1);
    expect(wrapper.find('ui-button[data-link-id="ok"]').exists()).toBe(true);
    wrapper.unmount();
    expect(store.listenerCount()).toBe(0);
  });

  it('registers useUiAction handlers for the life of the component', () => {
    const plugin = createUiPlugin();
    const seen = [];
    const Saver = defineComponent({
      setup() {
        useUiAction('save', (detail) => seen.push(detail.source));
        return () => h('span');
      },
    });
    const wrapper = mount(Saver, {
      global: { plugins: [plugin] },
      attachTo: container(),
    });
    const [handler] = plugin.registry.handlers('save');
    handler({ source: 'ok', event: 'press', action: ['emit', 'save'] });
    expect(seen).toEqual(['ok']);
    wrapper.unmount();
    expect(plugin.registry.handlers('save').length).toBe(0);
  });

  it('uses the view store before the plugin store inside UiView', async () => {
    const appStore = countedStore("(app: document (greeting: text 'App'))");
    const Reader = defineComponent({
      props: { id: String },
      setup() {
        const value = useUiProp('greeting', 'value');
        return () => h('i', { class: 'reader' }, value.value?.[0]);
      },
    });
    const source = "(app: document (greeting: text 'View') (r: reader))";
    const wrapper = mount(UiView, {
      props: { source, components: { reader: Reader } },
      global: { plugins: [createUiPlugin({ store: appStore })] },
      attachTo: container(),
    });
    await nextTick();
    await tick();
    expect(wrapper.find('.reader').text()).toBe('View');
    wrapper.unmount();
    expect(appStore.listenerCount()).toBe(0);
  });
});
