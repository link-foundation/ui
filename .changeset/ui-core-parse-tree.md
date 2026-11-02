---
'@link-foundation/ui-core': minor
---

Add `parse`, `parseOrThrow`, `toTree`, `format` and `walk`: `ui-core` now reads `ui-dialect/0` Links Notation into the UI element tree, gives the same tree for the one-line, multi-line and indented forms, reports problems as spec diagnostics, writes the tree back as text, and passes all 50 conformance fixtures of `docs/spec/fixtures/`.
