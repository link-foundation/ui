---
'@link-foundation/ui-store': minor
'@link-foundation/ui-config': patch
---

Add the `setPositional` store operation: `store.setPositional(id, values)` (and `{ op: 'setPositional', id, values }`) sets the positional values (atoms) of one element as one `update` event without `prop`, undoes with the old values and is written to the log as `(setPositional id values…)`. ui-config `bindStore` uses it instead of removing and inserting the element again, and `set`/patches reject a link among positional values with `bad-value`.
