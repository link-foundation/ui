// ui-dom alone: does a store.setPositional change reach the rendered DOM?
import { JSDOM } from 'jsdom';
import { mountDocument } from '@link-foundation/ui-dom';

const { window } = new JSDOM('<div id="app"></div>');
const container = window.document.getElementById('app');
const codes = [];
const { store, handle } = mountDocument(
  container,
  "(app: document (greeting: text 'Hello'))",
  { onDiagnostic: (d) => codes.push(d.code) }
);
const node = () => container.querySelector('[data-link-id="greeting"]');
store.setPositional('greeting', ['Hi (positional)']);
handle.flush();
console.log('after setPositional:', JSON.stringify(node().textContent));
store.setProp('greeting', 'value', ['Hi (named)']);
handle.flush();
console.log('after setProp value:', JSON.stringify(node().textContent));
console.log('diagnostics:', codes);
