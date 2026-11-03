// Usage of @link-foundation/ui-devmode in a browser: render the issue-1
// sample with ui-dom, keep its configuration with ui-config (the user layer
// in localStorage, the session layer in sessionStorage) and mount dev mode
// with the site policy of the issue.
//
// Query parameters of the page:
//   ?ui-dev            open dev mode on load
//   ?policy=disabled   a policy with (enabled false): dev mode is never
//                      loaded
//   ?lock=<id>         lock an element (and its children) for dev mode
// Serve the repository with `node scripts/serve-static.mjs` and open
// http://127.0.0.1:4173/packages/ui-devmode/examples/?ui-dev
import { parse } from '@link-foundation/ui-core';
import {
  createConfig,
  persistSessionLayer,
  persistUserLayer,
} from '@link-foundation/ui-config';
import { mountDocument } from '@link-foundation/ui-dom';
import { mountDevMode } from '@link-foundation/ui-devmode';

const SAMPLES = new URL(
  '../../../docs/case-studies/issue-1/samples/',
  import.meta.url
);
const read = async (name) => (await fetch(new URL(name, SAMPLES))).text();

const [text, styles, tokens, animations] = await Promise.all([
  read('document.lino'),
  read('styles.lino'),
  read('tokens.lino'),
  read('animation.lino'),
]);

const params = new globalThis.URLSearchParams(globalThis.location.search);
const locked = params.get('lock') ?? 'payment-form';
const policy =
  params.get('policy') === 'disabled'
    ? `site-dev-mode: dev-mode
  enabled false`
    : `site-dev-mode: dev-mode
  enabled true
  entry shortcut url-parameter element
  shortcut 'Alt+Shift+D'
  write-layers session user
  locked-elements ${locked}`;

const output = document.getElementById('action');
const app = document.getElementById('app');
const { store, handle } = mountDocument(app, text, {
  styles,
  tokens,
  setTitle: false,
  onAction: ({ source, event, action }) => {
    output.textContent = `${source} ${event} → (${action.join(' ')})`;
  },
});

// The document is the site layer; the user and session layers are restored
// from the storage first, then the store follows the resolved configuration.
const config = createConfig({ document: parse(text) });
persistUserLayer(config);
persistSessionLayer(config);
config.bindStore(store);

const devMode = mountDevMode({
  root: app,
  config,
  store,
  handle,
  styles,
  tokens,
  animations,
  policy,
});

document.getElementById('forget').addEventListener('click', () => {
  config.clear('user');
  config.clear('session');
});

// For the e2e checks and the console: the controller of dev mode.
globalThis.devMode = devMode;
// Signals the end of the first render (the e2e check waits for it).
app.dataset.ready = 'true';
