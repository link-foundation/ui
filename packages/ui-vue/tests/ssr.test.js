/**
 * Server rendering: `renderToString` without `window`, the `ssr` prop and
 * hydration on the client.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  UiVue,
  Vue,
  container,
  countedStore,
  installDom,
  hideDom,
  sample,
  useDom,
} from './setup-dom.js';

const { renderToString } = await import('vue/server-renderer');
const { createSSRApp, defineComponent, h } = Vue;
const { UiView, createUiPlugin, renderStaticHTML, useUiProp } = UiVue;

useDom();

/** Render an app to a string with no window globals. */
async function renderWithoutWindow(app) {
  hideDom();
  try {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    return await renderToString(app);
  } finally {
    installDom();
  }
}

const Chart = defineComponent({
  props: { id: String },
  setup: (props) => () => h('figure', props.id),
});

describe('server rendering', () => {
  it('renders an empty root without window', async () => {
    const html = await renderWithoutWindow(
      createSSRApp(() => h(UiView, { source: sample('document') }))
    );
    expect(html).toContain('data-ui-root');
    expect(html.includes('ui-button')).toBe(false);
  });

  it('inlines the ui-dom HTML with the ssr prop', async () => {
    const html = await renderWithoutWindow(
      createSSRApp(() =>
        h(UiView, { source: sample('document'), ssr: true, class: 'page' })
      )
    );
    expect(html).toContain('data-link-id="ok"');
    expect(html).toContain('<ui-button');
    expect(html).toContain('class="page"');
    expect(html).toContain('Hello, links');
  });

  it('renders the hosts of custom kinds and matches renderStaticHTML', async () => {
    const store = countedStore(
      "(app: document (greeting: text 'Hi') (sales: chart (values 1 2)))"
    );
    const html = await renderWithoutWindow(
      createSSRApp(() =>
        h(UiView, { store, ssr: true, components: { chart: Chart } })
      )
    );
    expect(html).toContain(
      '<ui-vue-host data-kind="chart" data-link-id="sales"></ui-vue-host>'
    );
    expect(html).toContain(renderStaticHTML(store, {}, { chart: Chart }));
    expect(store.listenerCount()).toBe(0);
  });

  it('computes composables once without subscribing', async () => {
    const store = countedStore(sample('document'));
    const Greeting = defineComponent({
      setup() {
        const value = useUiProp('greeting', 'value');
        return () => h('p', value.value?.[0]);
      },
    });
    const app = createSSRApp(Greeting).use(createUiPlugin({ store }));
    const html = await renderWithoutWindow(app);
    expect(html).toBe('<p>Hello, links</p>');
    expect(store.listenerCount()).toBe(0);
  });

  it('hydrates the server markup and renders it live on the client', async () => {
    const store = countedStore(sample('document'));
    const seen = [];
    const App = () =>
      h(UiView, {
        store,
        ssr: true,
        actions: { navigate: (detail) => seen.push(detail.action[1]) },
      });
    const html = await renderWithoutWindow(createSSRApp(App));
    const element = container();
    element.innerHTML = html;
    const warnings = [];
    const original = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    let app;
    try {
      app = createSSRApp(App);
      app.mount(element);
    } finally {
      console.warn = original;
    }
    expect(warnings).toEqual([]);
    expect(element.querySelectorAll('ui-button').length).toBe(1);
    element.querySelector('[data-link-id="ok"] button').click();
    expect(seen).toEqual(['home']);
    expect(store.listenerCount()).toBe(1);
    app.unmount();
    expect(store.listenerCount()).toBe(0);
  });
});
