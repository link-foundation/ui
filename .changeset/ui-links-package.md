---
'@link-foundation/ui-links': minor
'@link-foundation/ui-store': minor
'@link-foundation/ui-config': patch
---

Add `@link-foundation/ui-links`: associative links storages behind one doublets interface (memory, SQLite, doublets-web, and IndexedDB, `localStorage` or Links Notation text through persistence adapters), link-cli's substitution queries on any of them, types (`Type -> SubType -> … -> Value`, multiple inheritance) and permissions stored as links, a links server speaking the `clink --serve` protocol with authentication and subscriptions (in process and over TCP), and a synced client that keeps the part of the links its user may read, writes optimistically and sends the writes in order.

ui-store: add `writeDocumentLinks(encoded, links, names?)` and `readDocumentLinks(links, { names, roots })`: the doublets of a UI document in any storage with the doublets interface (the `@link-foundation/ui-links` storages, or a synced client of a links server), next to other data, read back from the links reachable from its roots.

ui-store: add the `setPositional` store operation: `store.setPositional(id, values)` (and `{ op: 'setPositional', id, values }`) sets the positional values (atoms) of one element as one `update` event without `prop`, undoes with the old values and is written to the log as `(setPositional id values…)`. ui-config `bindStore` uses it instead of removing and inserting the element again, and `set`/patches reject a link among positional values with `bad-value`.
