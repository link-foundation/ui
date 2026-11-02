---
'@link-foundation/ui-convert': minor
---

Add `@link-foundation/ui-convert` with the HTML/DOM importer: `importHtml(text)` and `importDom(root)` turn HTML text or a live DOM subtree into a `ui-dialect/0` Links Notation document with deterministic unique ids, source spans, a `nodeMap` back to the DOM nodes, a data mapping table with a lossless `html` fallback, inline styles as `(style ...)` links, and dropped scripts, event handlers and `javascript:` URLs reported as `dropped-script` diagnostics.
