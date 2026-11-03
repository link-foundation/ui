/**
 * The `components` prop: a custom kind rendered by a React component
 * through a portal into a `<ui-react-host>` node of ui-dom.
 */

import { describe, it, expect } from 'test-anywhere';
import { Profiler, useEffect } from 'react';
import { createStore } from '@link-foundation/ui-store';
import { UiView } from '@link-foundation/ui-react';
import { change, h, mount } from './setup-dom.js';

const CHART_DOC = `(app: document
  (body: stack
    (sales: chart
      (series 3 5 8)
      (title 'Sales')
      (caption: text 'Q1'))
    (greeting: text 'Hello')))`;

/** A chart that records its props and renders its children. */
function chartRecorder() {
  const renders = [];
  function Chart({ id, props, children }) {
    renders.push({ id, props });
    return h(
      'figure',
      { 'data-chart': id },
      h('figcaption', null, props.title?.[0]),
      h(
        'ol',
        null,
        (props.series ?? []).map((v, i) => h('li', { key: i }, v))
      ),
      children
    );
  }
  return { renders, Chart };
}

describe('components', () => {
  it('renders a chart kind through a portal and updates its props', async () => {
    const store = createStore({ text: CHART_DOC });
    const { renders, Chart } = chartRecorder();
    let viewRenders = 0;
    const view = await mount(
      h(
        Profiler,
        { id: 'v', onRender: (_, phase) => phase === 'mount' && viewRenders++ },
        h(UiView, { store, components: { chart: Chart } })
      )
    );
    const host = view.container.querySelector(
      'ui-react-host[data-kind="chart"][data-link-id="sales"]'
    );
    expect(host).not.toBe(null);
    const figure = host.querySelector('figure[data-chart="sales"]');
    expect(figure).not.toBe(null);
    expect(figure.querySelector('figcaption').textContent).toBe('Sales');
    expect(
      [...figure.querySelectorAll('li')].map((li) => li.textContent)
    ).toEqual(['3', '5', '8']);
    // The ui-dom children are rendered where the component puts children.
    expect(
      figure.querySelector('ui-text[data-link-id="caption"]').textContent
    ).toBe('Q1');
    expect(renders.at(-1).props.series).toEqual(['3', '5', '8']);
    const count = renders.length;

    await change(() => store.setProp('sales', 'series', ['1', '2']));
    expect(renders.at(-1).props.series).toEqual(['1', '2']);
    expect(
      [...figure.querySelectorAll('li')].map((li) => li.textContent)
    ).toEqual(['1', '2']);
    expect(renders.length).toBe(count + 1);

    // Another element does not re-render the chart.
    await change(() => store.setProp('greeting', 'value', ['Hi']));
    expect(renders.length).toBe(count + 1);
    // ui-dom still patches the children inside the component.
    await change(() => store.setProp('caption', 'value', ['Q2']));
    expect(figure.querySelector('[data-link-id="caption"]').textContent).toBe(
      'Q2'
    );
    expect(viewRenders).toBe(1);
    await view.unmount();
  });

  it('adds, renames and removes hosts with the store', async () => {
    const store = createStore({ text: CHART_DOC });
    const { renders, Chart } = chartRecorder();
    const view = await mount(
      h(UiView, { store, components: { chart: Chart } })
    );
    await change(() =>
      store.insert('body', 0, {
        id: 'costs',
        kind: 'chart',
        properties: [{ name: 'series', values: ['9'] }],
      })
    );
    expect(view.container.querySelectorAll('figure').length).toBe(2);
    expect(
      view.container.querySelector('figure[data-chart="costs"] li').textContent
    ).toBe('9');

    await change(() => store.rename('costs', 'spend'));
    expect(view.container.querySelector('figure[data-chart="spend"]')).not.toBe(
      null
    );
    await change(() => store.setProp('spend', 'series', ['10']));
    expect(renders.at(-1)).toEqual({ id: 'spend', props: { series: ['10'] } });

    await change(() => store.remove('sales'));
    expect(view.container.querySelectorAll('figure').length).toBe(1);
    expect(view.container.querySelectorAll('ui-react-host').length).toBe(1);
    await view.unmount();
    expect(view.container.querySelectorAll('ui-react-host').length).toBe(0);
  });

  it('cleans up component effects on unmount and with new components', async () => {
    const store = createStore({ text: CHART_DOC });
    const log = [];
    function Chart({ id }) {
      useEffect(() => {
        log.push(`mount ${id}`);
        return () => log.push(`unmount ${id}`);
      }, [id]);
      return h('canvas', { 'data-chart': id });
    }
    function Other({ id }) {
      return h('svg', { 'data-other': id });
    }
    const view = await mount(
      h(UiView, { store, components: { chart: Chart } })
    );
    expect(log).toEqual(['mount sales']);
    await view.rerender(h(UiView, { store, components: { chart: Other } }));
    expect(log).toEqual(['mount sales', 'unmount sales']);
    expect(view.container.querySelector('svg[data-other="sales"]')).not.toBe(
      null
    );
    // Without components, the kind falls back to ui-dom's unknown kind.
    await view.rerender(h(UiView, { store }));
    expect(view.container.querySelector('ui-react-host')).toBe(null);
    expect(view.container.querySelector('[data-link-id="sales"]')).not.toBe(
      null
    );
    await view.unmount();
  });
});
