---
'@link-foundation/ui-core': minor
---

Add `parseLinks(text)` and `formatLinks(values)`: read and write Links Notation as raw values (atoms, links and `{ id, values }`) through `links-notation`, without the element projection, so formats such as the `ui-store` operation log never need their own parser.
