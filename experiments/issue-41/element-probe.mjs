// Mount a link-view in jsdom and print its label, markers and SVG size.
import { JSDOM } from 'jsdom';
import { defineLinkView } from '../../packages/ui-components/src/links-view/index.js';

const dom = new JSDOM('<!doctype html><body></body>', {
  pretendToBeVisual: true,
});
const win = dom.window;
const frames = [];
defineLinkView(win, {
  animator: { raf: (cb) => frames.push(cb), caf: () => {}, now: () => 0 },
});
const el = win.document.createElement('link-view');
el.setAttribute(
  'lino',
  '(simple: link-view (link (id 1) (source 1) (target 2)) (markers (source bar) (target arrow)) (blueprint true) (grid true))'
);
win.document.body.append(el);
while (frames.length) {
  frames.shift()(0);
}
console.log(el.getAttribute('aria-label'), el.model, el.diagnostics, el.drawn);
console.log(
  el.shadowRoot.innerHTML.length,
  el.shadowRoot.querySelectorAll('circle').length
);
