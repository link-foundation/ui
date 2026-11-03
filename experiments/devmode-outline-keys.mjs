// Dev mode experiment: keyboard navigation of the outline tree in jsdom.
import { createPage, key, POLICY } from '../packages/ui-devmode/tests/setup.js';
import { mountDevMode } from '../packages/ui-devmode/src/index.js';

const page = createPage();
const dev = mountDevMode({ ...page, policy: POLICY });
await dev.open();
const shadow = page.document.querySelector('ui-devmode-inspector').shadowRoot;
shadow.querySelector('[data-id="app"] .row').click();
const sel = shadow.querySelector('[aria-selected="true"]');
console.log(
  'selected',
  sel?.dataset.id,
  'focus',
  shadow.activeElement?.dataset?.id
);
sel.addEventListener('keydown', (e) =>
  console.log('got key', e.key, e.target.tagName)
);
const ok = sel.dispatchEvent(key(page.window, { key: 'ArrowDown' }));
console.log('dispatched', ok, globalThis.linkUiDevMode.getSelection());
dev.destroy();
