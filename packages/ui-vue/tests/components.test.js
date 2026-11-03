/**
 * Custom kinds: Vue components teleported into ui-dom host elements.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  TestUtils,
  UiVue,
  Vue,
  container,
  countedStore,
  tick,
  useDom,
} from './setup-dom.js';

const { defineComponent, h, nextTick } = Vue;
const { mount } = TestUtils;
const { UiView, useUiProp } = UiVue;

useDom();

const SOURCE = `(app: document
  (body: stack
    (greeting: text 'Sales')
    (sales: chart (title 'Q1') (values 3 1 2))))`;

/** A chart that reads its element from the store of the view. */
const Chart = defineComponent({
  name: 'TestChart',
  props: { id: { type: String, required: true } },
  setup(props) {
    const title = useUiProp(() => props.id, 'title');
    const values = useUiProp(() => props.id, 'values');
    return () =>
      h('figure', { class: 'chart' }, [
        h('figcaption', title.value?.[0] ?? ''),
        ...(values.value ?? []).map((v) => h('span', { class: 'bar' }, v)),
      ]);
  },
});

/** Wait for ui-dom's patch and Vue's re-render. */
const settle = async () => {
  await tick();
  await nextTick();
};

describe('UiView components', () => {
  it('renders a chart kind with a Vue component through Teleport', async () => {
    const store = countedStore(SOURCE);
    const wrapper = mount(UiView, {
      props: { store, components: { chart: Chart } },
      attachTo: container(),
    });
    await nextTick();
    const host = wrapper.find('ui-vue-host[data-link-id="sales"]');
    expect(host.exists()).toBe(true);
    expect(host.attributes('data-kind')).toBe('chart');
    // The component is inside the host, in the ui-dom tree.
    expect(host.element.parentElement.localName).toBe('ui-stack');
    expect(host.find('figcaption').text()).toBe('Q1');
    expect(host.findAll('.bar').map((bar) => bar.text())).toEqual([
      '3',
      '1',
      '2',
    ]);

    store.setProp('sales', 'title', ['Q2']);
    store.setProp('sales', 'values', ['5', '4']);
    await settle();
    expect(host.find('figcaption').text()).toBe('Q2');
    expect(host.findAll('.bar').map((bar) => bar.text())).toEqual(['5', '4']);
    wrapper.unmount();
    expect(store.listenerCount()).toBe(0);
  });

  it('mounts and unmounts components with their elements', async () => {
    const store = countedStore(SOURCE);
    const wrapper = mount(UiView, {
      props: { store, components: { chart: Chart } },
      attachTo: container(),
    });
    await nextTick();
    store.insert('body', undefined, {
      id: 'costs',
      kind: 'chart',
      properties: [{ name: 'title', values: ['Costs'] }],
    });
    await settle();
    expect(wrapper.findAll('figure').length).toBe(2);
    expect(wrapper.find('[data-link-id="costs"] figcaption').text()).toBe(
      'Costs'
    );
    const listeners = store.listenerCount();
    store.remove('sales');
    await settle();
    expect(wrapper.findAll('figure').length).toBe(1);
    // The removed chart's composables released their listeners.
    expect(store.listenerCount()).toBe(listeners - 2);
    wrapper.unmount();
    expect(store.listenerCount()).toBe(0);
  });

  it('passes the new ID after a rename', async () => {
    const store = countedStore(SOURCE);
    const wrapper = mount(UiView, {
      props: { store, components: { chart: Chart } },
      attachTo: container(),
    });
    await nextTick();
    store.rename('sales', 'revenue');
    await settle();
    store.setProp('revenue', 'title', ['Renamed']);
    await settle();
    expect(wrapper.find('[data-link-id="revenue"] figcaption').text()).toBe(
      'Renamed'
    );
    wrapper.unmount();
  });

  it('renders a kind without a component with ui-dom', async () => {
    const wrapper = mount(UiView, {
      props: { source: SOURCE },
      attachTo: container(),
    });
    await nextTick();
    expect(wrapper.find('ui-vue-host').exists()).toBe(false);
    expect(wrapper.find('[data-link-id="sales"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
