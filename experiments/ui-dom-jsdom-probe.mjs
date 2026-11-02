// What jsdom supports for the ui-dom renderer tests.
import { JSDOM } from 'jsdom';
const { window } = new JSDOM('<!doctype html><body><div id=c></div></body>');
const { document } = window;
window.customElements.define('ui-x', class extends window.HTMLElement {});
const n = document.createElement('ui-x');
console.log(
  'custom element ok:',
  n instanceof window.HTMLElement,
  n.constructor.name
);
console.log('adoptedStyleSheets' in document, typeof window.CSSStyleSheet);
try {
  const s = new window.CSSStyleSheet();
  s.replaceSync('a{color:red}');
  document.adoptedStyleSheets = [s];
  console.log('adopted', document.adoptedStyleSheets.length, s.cssRules.length);
} catch (e) {
  console.log('no constructable', e.message);
}
n.style.setProperty('gap', 'var(--space-medium)');
n.style.setProperty('--ui-gap', 'var(--space-medium)');
console.log('style attr:', n.getAttribute('style'));
console.log(typeof window.MutationObserver, typeof window.queueMicrotask);
