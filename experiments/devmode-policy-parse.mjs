// Dev mode experiment: how ui-core parses the dev-mode policy link.
import { parse } from '@link-foundation/ui-core';
const text = `(site-dev-mode: dev-mode
  (enabled true)
  (entry shortcut url-parameter element)
  (shortcut 'Alt+Shift+D')
  (write-layers session user)
  (locked-elements payment-form))`;
const doc = parse(text);
console.log(JSON.stringify(doc.roots, null, 1).slice(0, 1500));
console.log(doc.diagnostics);
console.log(Object.keys(doc));
