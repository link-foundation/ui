// Smoke test of the layout kinds in jsdom: render a page with every kind
// and print the shape of the result. Run: node experiments/issue-36-kinds-smoke.mjs
import { JSDOM } from 'jsdom';
import { mountDocument } from '@link-foundation/ui-dom';
import {
  layoutVocabulary,
  dockLayout,
  splitSizes,
  activeTab,
} from '@link-foundation/ui-components';

const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {
  pretendToBeVisual: true,
});
const { window } = dom;
const { document } = window;
const store = new Map();
const storage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
};
const text = `(page: app-shell (label Main) (bottom-bar nav) (rail nav) (drawer nav)
  (nav: stack (direction vertical) (gap 8px) (home: button 'Home'))
  (content: stack
    (chat: split (label Chat) (sizes 30 70) (min 10) (remember-size chat.sizes)
      (list: stack (a: text 'List'))
      (thread: stack (b: text 'Thread')))
    (tabs: tab-group (label Inspector)
      (styles: panel (title Styles) (s: text 'S'))
      (events: panel (title Events) (closable true) (e: text 'E')))
    (designer: dock (label Designer) (persist designer.layout)
      (left: region (size 16rem) (panels toolbox outline))
      (right: region (size 20rem) (panels properties))
      (center: region (panels canvas))
      (toolbox: panel (title Toolbox) (t: text 'T'))
      (outline: panel (title Outline) (o: text 'O'))
      (properties: panel (title Properties) (p: text 'P'))
      (canvas: panel (title Canvas) (closable false) (c: text 'C')))
    (inspector: window (title Inspector) (open false) (x 5000) (y 20)
      (i: text 'I'))))`;
const diags = [];
const { handle } = mountDocument(document.getElementById('app'), text, {
  parseOptions: { vocabulary: layoutVocabulary() },
  layout: { storage },
  onDiagnostic: (d) => diags.push(d),
});
await new Promise((r) => setTimeout(r, 10));
console.log('diagnostics', JSON.stringify(diags));
const dock = handle.nodeFor('designer');
console.log('dock layout', JSON.stringify(dockLayout(dock)));
console.log(
  'dock regions',
  [...dock.querySelectorAll('.ui-dock-region')].map(
    (r) =>
      `${r.dataset.side}:${[...r.querySelectorAll('[role=tab]')].map((t) => t.textContent).join(',')} hidden=${r.hidden}`
  )
);
console.log(
  'grid',
  dock.style.gridTemplateColumns,
  '|',
  dock.style.gridTemplateRows
);
const split = handle.nodeFor('chat');
console.log(
  'split',
  splitSizes(split),
  split.getAttribute('role'),
  [...split.querySelectorAll('[role=separator]')].map((d) => d.outerHTML)
);
const tabs = handle.nodeFor('tabs');
console.log(
  'tabs',
  activeTab(tabs),
  tabs.querySelector('[role=tablist]').outerHTML.slice(0, 300)
);
const shell = handle.nodeFor('page');
console.log(
  'shell',
  shell.getAttribute('mode'),
  handle.nodeFor('nav').getAttribute('role')
);
// move outline right through the actions menu
const leftRegion = dock.querySelector('.ui-dock-region[data-side=left]');
leftRegion.querySelectorAll('[role=tab]')[1].click();
leftRegion.querySelector('.ui-tab-actions').click();
const items = [...leftRegion.querySelectorAll('[role=menuitem]')];
console.log(
  'actions',
  items.map((i) => i.textContent)
);
items.find((i) => i.textContent === 'Move to right').click();
console.log('after move', JSON.stringify(dockLayout(dock).regions));
console.log('stored', store.get('designer.layout'));
console.log('focused', document.activeElement.outerHTML.slice(0, 120));
// split keyboard
const divider = split.querySelector('[role=separator]');
divider.dispatchEvent(
  new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
);
console.log(
  'split after right',
  splitSizes(split),
  divider.getAttribute('aria-valuenow'),
  store.get('chat.sizes')
);
// window
const win = handle.nodeFor('inspector');
console.log(
  'window hidden',
  win.hidden,
  win.style.left,
  win.getAttribute('role')
);
handle.store.update?.('inspector', { open: 'true' });
