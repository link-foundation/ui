---
'@link-foundation/ui-core': patch
---

Split the Windows Bun CI suite into three independent file shards to keep process-heavy fixture tests within the existing execution budget. Isolate Bun test files so sorted discovery cannot leak DOM globals or cached framework runtimes between files. Published package code is unchanged.
