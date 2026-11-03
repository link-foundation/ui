// Dev mode experiment: mount the issue-1 sample with ui-dom in jsdom, open
// dev mode and drive it through the global handle.
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import { mountDocument } from '@link-foundation/ui-dom';
import { mountDevMode } from '../packages/ui-devmode/src/index.js';

const s = (n) =>
  readFileSync(`docs/case-studies/issue-1/samples/${n}.lino`, 'utf8');
const dom = new JSDOM(
  '<!doctype html><html><head></head><body><div id="app"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true }
);
const { window } = dom;
for (const key of ['HTMLElement', 'customElements', 'document', 'Node']) {
  globalThis[key] = window[key];
}
const root = window.document.getElementById('app');
const text = s('document');
const { store, handle } = mountDocument(root, text, {
  styles: s('styles'),
  tokens: s('tokens'),
  setTitle: false,
  onAction: (a) => console.log('ACTION', a.source),
});
const config = createConfig({ document: parse(text) });
config.bindStore(store);
const dev = mountDevMode({
  root,
  config,
  store,
  handle,
  window,
  styles: s('styles'),
  tokens: s('tokens'),
  policy:
    "(site-dev-mode: dev-mode (enabled true) (entry shortcut url-parameter element) (shortcut 'Alt+Shift+D') (write-layers session user) (locked-elements payment-form))",
});
console.log('open', await dev.open());
const h = globalThis.linkUiDevMode;
console.log('global', Object.keys(h));
const host = window.document.querySelector('ui-devmode-inspector');
const shadow = host?.shadowRoot;
console.log('host', host?.tagName);
console.log(
  'tree',
  [...shadow.querySelectorAll('[role=treeitem]')].map(
    (n) => `${n.getAttribute('aria-level')}:${n.dataset.id}`
  )
);
console.log('select', h.select('ok'), JSON.stringify(h.getSelection()));
const row = () => shadow.querySelector('tr[data-name="label"]');
console.log('row', row()?.dataset.layer, row()?.className);
h.setProperty('ok', 'label', 'Okay');
await new Promise((r) => setTimeout(r, 50));
console.log('dom', root.querySelector('[data-link-id="ok"]')?.textContent);
console.log('row', row()?.dataset.layer, row()?.className);
shadow.querySelector('[data-command="save"]')?.click();
await new Promise((r) => setTimeout(r, 50));
console.log('row after save', row()?.dataset.layer);
row().querySelector('button').click();
await new Promise((r) => setTimeout(r, 50));
console.log(
  'row after reset',
  row()?.dataset.layer,
  row().querySelector('button').disabled
);
try {
  h.setProperty('ok', 'label', 'X');
} catch (e) {
  console.log('err', e.message);
}
// click on ok while picking
const okNode = root.querySelector('[data-link-id="ok"]');
dev.close();
console.log('closed', globalThis.linkUiDevMode, dev.isOpen);
okNode.click();
console.log('-- after close, click delivered above? now reopen and pick');
await dev.open();
const click = () =>
  okNode.dispatchEvent(
    new window.MouseEvent('click', { bubbles: true, composed: true })
  );
click();
console.log('picked', JSON.stringify(globalThis.linkUiDevMode.getSelection()));
window.document.dispatchEvent(
  new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
);
console.log('open after 1 esc', dev.isOpen);
window.document.dispatchEvent(
  new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
);
console.log('open after 2 esc', dev.isOpen);
dev.destroy();
