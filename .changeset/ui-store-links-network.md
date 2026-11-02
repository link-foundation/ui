---
'@link-foundation/ui-core': minor
'@link-foundation/ui-store': minor
---

Add `@link-foundation/ui-store`: a UI document as a mutable links network with stable IDs, change events, nested transactions, undo/redo and an ordered operation log that is written and read as Links Notation (`logToLino`, `logFromLino`) and can be replayed. ui-core gains `parseLinks(text)` and `formatLinks(values)`, which read and write Links Notation as raw values (atoms, links and `{ id, values }`) through `links-notation`, without the element projection, so formats such as the ui-store operation log need no parser of their own.
