---
'@link-foundation/ui-core': patch
---

Add `packages/ui-kotlin/`, the Jetpack Compose / Compose Multiplatform renderer of `ui-dialect/0` (desktop target, optional Android target): `UiView` draws `document`, `stack`, `text`, `button` and `image` with Material 3, uses the generated ui-tokens Kotlin output as its default theme and reads theme `.lino` files at run time, sends `(on ...)` actions to the host as `UiAction` data (rejecting `javascript:`, `data:` and `vbscript:` targets), tags every element with its id, and has LiNo render-tree snapshots for the shared fixtures. Also adds the desktop example in `examples/kotlin/` and the ui-kotlin CI jobs.
