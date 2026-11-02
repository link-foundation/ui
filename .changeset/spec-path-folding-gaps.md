---
'@link-foundation/ui-core': patch
---

Align the `ui-dialect/0` reference projection with path folding: a multi-line anonymous child declares its head once, an unfoldable path link is kept once in `unknown`, and an unknown sublink with indented lines stays one `unknown` value in all three forms. Add the `shapes/nested-anonymous`, `shapes/unfoldable-path` and `shapes/unknown-children` fixtures and state these rules in `docs/spec/projection.md`.
