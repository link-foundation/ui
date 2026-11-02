// Usage of @link-foundation/ui-dom in a browser: mount the issue-1 sample
// document with its styles and tokens, show the `ui-action` of the OK button
// and change the greeting through the store (one incremental patch).
// Serve the repository with `node scripts/serve-static.mjs` and open
// http://127.0.0.1:4173/examples/ui-dom/
import { mountDocument } from '@link-foundation/ui-dom';

const SAMPLES = new URL(
  '../../docs/case-studies/issue-1/samples/',
  import.meta.url
);
const read = async (name) => (await fetch(new URL(name, SAMPLES))).text();

const [document_, styles, tokens] = await Promise.all([
  read('document.lino'),
  read('styles.lino'),
  read('tokens.lino'),
]);

const output = document.getElementById('action');
const app = document.getElementById('app');
const { store, diagnostics } = mountDocument(app, document_, {
  styles,
  tokens,
  setTitle: false,
  onAction: ({ source, event, action }) => {
    output.textContent = `${source} ${event} → (${action.join(' ')})`;
  },
});
// The sample theme `(extends base)` names a set the sample does not define.
console.info('ui-dom diagnostics', diagnostics);

const greetings = ['Hello, links', 'Hello again, links'];
document.getElementById('change').addEventListener('click', () => {
  const now = store.get('greeting').properties.find((p) => p.name === 'value');
  const current = now?.values[0] ?? greetings[0];
  const next = greetings[(greetings.indexOf(current) + 1) % greetings.length];
  store.setProp('greeting', 'value', [next]);
});

// Signals the end of the first render (the e2e check waits for it).
app.dataset.ready = 'true';
