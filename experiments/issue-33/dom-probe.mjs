import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>');
const { window } = dom;
Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  customElements: window.customElements,
  CustomEvent: window.CustomEvent,
});
const { mountBehavior } =
  await import('../../packages/ui-components/src/behavior/dom.js');
import { createManualClock } from '../../packages/ui-components/src/behavior/interpret.js';
const clock = createManualClock();
const text = `(page: document
  (bold: button (label Bold) (machine toggle-machine))
  (more: button (label Details) (machine disclosure-machine (content panel)))
  (panel: stack (t: text 'Hidden details'))
  (bad: button (label Bad) (on press 'alert(1)'))
  (go: button (label Go) (on press (navigate 'javascript:alert(1)'))))`;
const b = mountBehavior(window.document.getElementById('app'), text, {
  clock,
  onDiagnostic: (d) => console.log('diag', d.code, JSON.stringify(d.at)),
});
const html = () => window.document.getElementById('app').innerHTML;
console.log(html());
const bold = b.handle.nodeFor('bold').firstChild;
bold.dispatchEvent(
  new window.KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  })
);
console.log(
  'bold',
  bold.getAttribute('aria-pressed'),
  b.serviceFor('bold').state
);
bold.click();
console.log('bold', bold.getAttribute('aria-pressed'));
const more = b.handle.nodeFor('more').firstChild;
more.focus();
more.click();
const panel = b.handle.nodeFor('panel');
console.log(
  'more',
  more.getAttribute('aria-expanded'),
  panel.hidden,
  window.document.activeElement === panel
);
panel.dispatchEvent(
  new window.KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  })
);
console.log(
  'after esc',
  b.serviceFor('more').state,
  window.document.activeElement === more,
  panel.hidden
);
clock.advance(500);
console.log('after 500', b.serviceFor('more').state, panel.hidden);
b.handle.nodeFor('go').firstChild.click();
b.store.remove('bold');
b.handle.flush();
await Promise.resolve();
console.log('bold service', b.serviceFor('bold'));
b.destroy();
console.log('destroyed', b.serviceFor('more'));
