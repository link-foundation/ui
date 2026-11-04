---
'@link-foundation/ui-react': patch
---

Isolate the production action-warning test environment so parallel Deno workers cannot load empty React scheduler exports.
