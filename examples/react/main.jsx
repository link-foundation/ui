// Usage of @link-foundation/ui-react in a Vite + React app:
// - the issue-1 sample document with its styles and tokens, in a <UiView>;
// - a counter that changes `greeting` through the store (one DOM patch,
//   the <UiView> itself does not re-render) and reads it back with a hook;
// - a custom `chart` kind rendered by a React component through a portal.
// Run `npm install && npm run dev` in this folder.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  UiProvider,
  UiView,
  propOf,
  storeOfSource,
  useUiAction,
  useUiProp,
} from '@link-foundation/ui-react';
import sampleDocument from '../../docs/case-studies/issue-1/samples/document.lino?raw';
import sampleStyles from '../../docs/case-studies/issue-1/samples/styles.lino?raw';
import sampleTokens from '../../docs/case-studies/issue-1/samples/tokens.lino?raw';

const { store } = storeOfSource(sampleDocument);
const { store: chartStore } = storeOfSource(
  `report: document
  body: stack
    sales: chart
      title 'Presses'
      series 1`
);

/** The `chart` kind: a bar per value of `series`. */
function Chart({ id, props }) {
  const [title = id] = props.title ?? [];
  const series = (props.series ?? []).map(Number);
  const top = Math.max(1, ...series);
  return (
    <figure className="chart" data-chart={id}>
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${series.length * 24} 100`} role="img">
        {series.map((value, i) => (
          <rect
            key={i}
            x={i * 24 + 4}
            y={100 - (value / top) * 96}
            width="16"
            height={(value / top) * 96}
          />
        ))}
      </svg>
    </figure>
  );
}

/** Reads the greeting back with a hook: re-renders only when it changes. */
function GreetingMirror() {
  const [greeting] = useUiProp('greeting', 'value', store) ?? [];
  return (
    <p>
      <code>useUiProp(&apos;greeting&apos;, &apos;value&apos;)</code>:{' '}
      <strong data-testid="mirror">{greeting}</strong>
    </p>
  );
}

function Counter() {
  const [count, setCount] = useState(0);
  const press = () => {
    const next = count + 1;
    setCount(next);
    store.setProp('greeting', 'value', [`Hello, links × ${next}`]);
    // Store values are strings; propOf reads `series` wherever it is kept.
    const series = propOf(chartStore.get('sales'), 'series') ?? [];
    chartStore.setProp('sales', 'series', [...series, String(next + 1)]);
  };
  return (
    <button type="button" className="counter" onClick={press}>
      Change the greeting ({count})
    </button>
  );
}

/** Logs the OK button's `(navigate home)` action. */
function ActionLog() {
  const [last, setLast] = useState('press OK');
  useUiAction('navigate', ({ source, event, action }) => {
    setLast(`${source} ${event} → (${action.join(' ')})`);
  });
  return <output data-testid="action">{last}</output>;
}

function App() {
  return (
    <UiProvider store={store}>
      <main>
        <h1>ui-react example</h1>
        <UiView styles={sampleStyles} tokens={sampleTokens} setTitle={false} />
        <section className="controls">
          <Counter />
          <ActionLog />
        </section>
        <GreetingMirror />
        <UiView store={chartStore} components={{ chart: Chart }} />
      </main>
    </UiProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
