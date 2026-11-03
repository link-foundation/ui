/**
 * UiView: mounting the issue-1 sample, store-driven patches without a Vue
 * re-render, source changes, and cleanup over many mounts.
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
  uiNodes,
  useDom,
} from './setup-dom.js';

const { defineComponent, h, nextTick, ref } = Vue;
const { mount } = TestUtils;
const { UiView } = UiVue;

useDom();

/** UiView whose render function counts its runs. */
function countingView() {
  const counter = { renders: 0 };
  const component = defineComponent({
    ...UiView,
    name: 'CountingUiView',
    setup(props, context) {
      const renderView = UiView.setup(props, context);
      return (...args) => {
        counter.renders += 1;
        return renderView(...args);
      };
    },
  });
  return { component, counter };
}

describe('UiView', () => {
  it('renders ui-button[data-link-id="ok"] for the sample', () => {
    const wrapper = mount(UiView, {
      props: { source: sample('document') },
      attachTo: container(),
    });
    const root = wrapper.find('[data-ui-root]');
    expect(root.exists()).toBe(true);
    expect(root.find('ui-button[data-link-id="ok"]').exists()).toBe(true);
    expect(root.find('ui-text[data-link-id="greeting"]').text()).toBe(
      'Hello, links'
    );
    wrapper.unmount();
  });

  it('patches the DOM from the store without re-running its render function', async () => {
    const store = countedStore(sample('document'));
    const { component, counter } = countingView();
    const wrapper = mount(component, {
      props: { store },
      attachTo: container(),
    });
    expect(counter.renders).toBe(1);
    store.setProp('greeting', 'value', ['Hello, Vue']);
    await tick();
    expect(wrapper.find('[data-link-id="greeting"]').text()).toBe('Hello, Vue');
    store.setProp('ok', 'label', ['Done']);
    await tick();
    expect(wrapper.find('[data-link-id="ok"]').text()).toBe('Done');
    expect(counter.renders).toBe(1);
    wrapper.unmount();
  });

  it('passes attributes to the root element', () => {
    const wrapper = mount(UiView, {
      props: { source: sample('document') },
      attrs: { class: 'page', id: 'main' },
      attachTo: container(),
    });
    const root = wrapper.find('[data-ui-root]');
    expect(root.attributes('class')).toBe('page');
    expect(root.attributes('id')).toBe('main');
    wrapper.unmount();
  });

  it('re-creates the store only when source changes', async () => {
    const source = ref("(app: document (greeting: text 'One'))");
    const Probe = defineComponent({
      setup: () => () => h(UiView, { source: source.value }),
    });
    const wrapper = mount(Probe, { attachTo: container() });
    expect(wrapper.find('[data-link-id="greeting"]').text()).toBe('One');
    source.value = "(app: document (greeting: text 'Two'))";
    await nextTick();
    await tick();
    expect(wrapper.find('[data-link-id="greeting"]').text()).toBe('Two');
    expect(wrapper.findAll('ui-document').length).toBe(1);
    wrapper.unmount();
  });

  it('follows a new store prop', async () => {
    const first = countedStore("(app: document (greeting: text 'First'))");
    const second = countedStore("(app: document (greeting: text 'Second'))");
    const wrapper = mount(UiView, {
      props: { store: first },
      attachTo: container(),
    });
    expect(first.listenerCount()).toBe(1);
    await wrapper.setProps({ store: second });
    expect(wrapper.find('[data-link-id="greeting"]').text()).toBe('Second');
    expect(first.listenerCount()).toBe(0);
    expect(second.listenerCount()).toBe(1);
    wrapper.unmount();
    expect(second.listenerCount()).toBe(0);
  });

  it('leaves no store listeners and no ui-* nodes after 100 mounts', () => {
    const store = countedStore(sample('document'));
    const Chart = defineComponent({
      props: { id: String },
      setup: (props) => () => h('span', props.id),
    });
    for (let i = 0; i < 100; i += 1) {
      const wrapper = mount(UiView, {
        props: { store, components: { chart: Chart } },
        attachTo: container(),
      });
      expect(store.listenerCount()).toBe(1);
      wrapper.unmount();
    }
    expect(store.listenerCount()).toBe(0);
    expect(uiNodes().length).toBe(0);
  });
});
