// Probe: how ui-core parses `(icon close)` and `(icon (set lucide) (name check))`
// (the `icon` kind is not in docs/spec/vocabulary.lino yet).
import { parse } from '@link-foundation/ui-core';
const text = `(app: document
  (icon close)
  (ok: icon (set lucide) (name check) (label 'Done')))`;
const result = parse(text);
console.log(Object.keys(result));
const { roots: document, diagnostics } = result;
console.log(JSON.stringify(document, null, 1).slice(0, 2500));
console.log(diagnostics);
