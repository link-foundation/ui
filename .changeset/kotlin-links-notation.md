---
'@link-foundation/ui-core': patch
---

Add a pure Kotlin Multiplatform Links Notation parser under `native/kotlin/links-notation/`, with a vendored copy of the upstream parity corpus (`native/parity/`). It passes that corpus and the ui-dialect/0 parser vectors (`docs/spec/parser-vectors.json`, including the reference error messages) on JVM, Android, iOS, JS and Wasm (`docs/native-parsers.md`).
