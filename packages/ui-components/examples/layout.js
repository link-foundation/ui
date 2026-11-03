// The layout gallery of @link-foundation/ui-components: an app
// shell with a designer dock, a split that remembers its sizes, a tab group,
// a window and a grid, rendered by ui-dom from layout.lino.
// Serve the repository with `node scripts/serve-static.mjs` and open
// http://127.0.0.1:4173/packages/ui-components/examples/layout.html
import { mountDocument } from '@link-foundation/ui-dom';
import {
  createLayerManager,
  layoutVocabulary,
} from '@link-foundation/ui-components';

const text = await (
  await fetch(new URL('layout.lino', import.meta.url))
).text();
const app = document.getElementById('app');

/** The first control inside an element (to move the focus there). */
const firstControl = (node) =>
  node.querySelector(
    '[role=tab][tabindex="0"], [role=separator], button, [tabindex="0"]'
  ) ?? node;

const { store, handle, diagnostics } = mountDocument(app, text, {
  setTitle: false,
  parseOptions: { vocabulary: layoutVocabulary() },
  layout: { storage: window.localStorage, layers: createLayerManager() },
  onAction: ({ action }) => {
    const [name, target, property, value] = action;
    if (name === 'set') {
      store.setProp(target, property, [value]);
    } else if (name === 'focus') {
      const node = handle.nodeFor(target);
      node?.scrollIntoView({ block: 'nearest' });
      firstControl(node)?.focus();
    }
  },
});
if (diagnostics.length > 0) {
  console.warn('layout gallery diagnostics', diagnostics);
}

// The window hides itself on close; the store gets `(open false)` back.
app.addEventListener('window-close', (event) => {
  store.setProp(event.detail.id, 'open', ['false']);
});

// Signals the end of the first render (the e2e tests wait for it).
await new Promise((resolve) => window.requestAnimationFrame(resolve));
app.dataset.ready = 'true';
