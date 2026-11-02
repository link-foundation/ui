/**
 * Import HTML into the UI dialect of Links Notation and read it back.
 *
 * Run from the repository root after `npm install`:
 *   node examples/html-import.js
 */

import { format, parse } from '@link-foundation/ui-core';
import { htmlVocabulary, importHtml } from '@link-foundation/ui-convert';

const html = `<form id="login">
  <h1>Sign in</h1>
  <label>Email</label>
  <button class="primary" onclick="steal()">OK</button>
  <div style="padding: 8px; color: #3390ec">Help</div>
</form>`;

const { text, spans, diagnostics } = importHtml(html);
console.log(text);

for (const [id, { start, end }] of spans) {
  console.log(`${id}: ${html.slice(start, end).split('\n')[0]}`);
}
for (const diagnostic of diagnostics) {
  console.log(`${diagnostic.code}: ${diagnostic.message}`);
}

const doc = parse(text, { vocabulary: htmlVocabulary() });
console.log('round trip:', format(doc) === text, doc.diagnostics.length);
