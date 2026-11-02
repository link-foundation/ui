---
'@link-foundation/ui-core': patch
---

Add `ui-swift`, the SwiftUI renderer (`packages/ui-swift`, root `Package.swift`): `UiSwiftCore` (Foundation only: the spec projection, themes with the F11 default, `(on …)` actions and a platform-neutral render tree with LiNo snapshots of the spec fixtures), `UiSwiftUI` (`UiView(document:theme:onAction:)` over a per-element `@Observable` model) and the `UiDemo` macOS app, with Linux and macOS CI jobs.
