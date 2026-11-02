---
'@link-foundation/ui-dom': minor
---

Add `@link-foundation/ui-dom`, the reference DOM renderer: a ui-store document renders as plain custom elements in the light DOM (`ui-document`, `ui-stack`, `ui-text`, `ui-button`, `ui-image`, `ui-unknown`) with stable `data-link-id` attributes, incremental patches batched into one microtask, `(on press ...)` handlers dispatched as bubbling `ui-action` events without running code, ui-style and ui-tokens CSS adopted once per root, a kind registry (`defineKind`), `renderToHTML` for static HTML, and an example page with a Playwright check.
