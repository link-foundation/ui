---
'@link-foundation/ui-store': minor
---

Add IndexedDB persistence: `openPersistentStore({ name, indexedDB?, initialText?, channel? })` returns a store saved to the database `link-ui-<name>` as a doublets table (`encodeDocument` / `decodeDocument`, compatible with `doublets-web`) plus a write-through Links Notation operation log, with `flush`, `compact`, `.lino` bundle export/import (checked against ui-core size and depth limits, replaced in one transaction), `reload`, `close`, `destroy` and `BroadcastChannel` reloads across tabs. `copyToDoubletsWeb(encoded, unitedLinks)` copies the doublets into a `doublets-web` `UnitedLinks` (optional peer dependency, loaded only by `openDoubletsWeb()`). `createStore` gains the `ids` option.
