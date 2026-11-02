// Smoke run of ui-dom in jsdom: render the issue-1 sample, patch, HTML.
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const dom = new JSDOM(
  '<!doctype html><html><head></head><body><div id="app"></div></body></html>'
);
globalThis.window = dom.window;
const { mountDocument, renderToHTML } = await import('@link-foundation/ui-dom');
const read = (n) =>
  readFileSync(`docs/case-studies/issue-1/samples/${n}.lino`, 'utf8');
const container = dom.window.document.getElementById('app');
const { store, handle, diagnostics } = mountDocument(
  container,
  read('document'),
  {
    tokens: read('tokens'),
    styles: read('styles'),
    onAction: (d) => console.log('action', JSON.stringify(d)),
  }
);
console.log(container.innerHTML);
console.log(diagnostics.map((d) => d.message));
console.log(dom.window.document.head.innerHTML.slice(0, 200));
store.setProp('greeting', 'value', ['Hi']);
handle.flush();
console.log(container.innerHTML);
container.querySelector('button').click();
console.log(renderToHTML(read('document')));
const bg = dom.window.getComputedStyle(handle.nodeFor('ok')).backgroundColor;
console.log('bg', bg);
handle.destroy();
console.log(
  'after',
  JSON.stringify(container.innerHTML),
  dom.window.document.head.innerHTML.length
);
