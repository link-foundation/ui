---
'@link-foundation/ui-config': minor
---

Add `@link-foundation/ui-config`: every property of a UI document resolved through the layers defaults < theme < site < user < session, with the layer that won (`resolve`, `explain`). User and session overrides are edited with `set`/`unset`, and any layer is loaded, imported and exported as a Links Notation `overrides` patch (`readPatch`, `writePatch`, diff-only `exportPatch`, with 64 KiB / 2,000-op limits and diagnostics). `describeChanges` explains overrides in plain English, `persistLayer` keeps the user and session layers in Web Storage, and `bindStore` applies every change to a ui-store store as one transaction with the origin `config`.
