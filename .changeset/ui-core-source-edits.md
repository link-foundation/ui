---
'@link-foundation/ui-core': patch
---

Add `@link-foundation/ui-core/source`: edit a LiNo document in place and keep its comments and layout. `indexSource` maps every element, property and value to its span, each span checked against the `links-notation` parser; `setProp`, `removeProp`, `setPositional`, `insertChild`, `removeNode`, `moveNode`, `renameId` and `applyOpsToSource` change only the bytes they must and check the result against the expected tree. Declare `note` as a property of every kind in `ui-dialect/0`.
