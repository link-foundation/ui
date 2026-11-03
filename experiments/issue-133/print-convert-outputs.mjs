// Print the nested output of ui-convert importers for the inputs used in
// the tests, to update their expectations (#133).
import { JSDOM } from 'jsdom';
import { importHtml, importDom } from '../../packages/ui-convert/src/index.js';

const show = (label, text) => console.log(`=== ${label}\n${text}`);
show('ids', importHtml('<p id="x">1</p><p id="x">2</p><p id="x">3</p>').text);
const { document } = new JSDOM(
  '<body><nav id="menu"><a href="/">Home</a></nav><p>Other</p></body>'
).window;
show('dom', importDom(document.getElementById('menu')).text);
show(
  'doc',
  importHtml(
    '<!doctype html><html><head><title>T</title></head><body><p>Hi</p></body></html>',
    { document: true }
  ).text
);
show(
  'comments',
  importHtml('<div><!-- note --><p>A</p></div>', { comments: true }).text
);
show(
  'style',
  importHtml('<div style="padding: 8px; color: #3390ec"></div>').text
);
show(
  'attrs',
  importHtml(
    '<div class="card" data-id="7" hidden aria-label="Card one"></div>'
  ).text
);
