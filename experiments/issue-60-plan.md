# Issue 60 work plan

- [x] Read issue, all comments, PR conversations/reviews/inline comments, repository guidance and related importer PR #107. No required sub-issues or comments exist.
- [x] Dependencies #26/#27 closed; #59 and #19 merged. Implement round trip and real token identifiers.
- [x] Core export API, action collection and wrapper escaping.
- [x] React/Vue wrapper and semantic eject output, CSS/token references.
- [x] SwiftUI/Compose data tables, printers, actions and state.
- [x] CLI stdout/directory support preserving existing interop CLI.
- [x] Golden document/form/unsupported fixtures for every target/mode; determinism, tree input, diagnostics, escaping and round trip.
- [x] Vite wrapper builds and original UiView DOM comparison; optional native compilation with real SDKs only.
- [ ] Documentation, changeset, review full diff, required checks on pushed revision.
- [ ] Merge latest main, push only prepared branch; collect all CI failures before fixes; update PR evidence and mark ready after green CI.

API assumption: exportDocument is asynchronous because Prettier 3 has an asynchronous public formatting API. Native exports are source-only; token references default to the existing Tokens namespace. Unsupported output retains comments and diagnostics rather than inventing behavior.

Verification so far: 41 focused Node tests pass, two real-SDK checks skip; Bun matches. Browser preview action clicks pass for both targets and axe reports zero WCAG A/AA violations. Screenshot: docs/screenshots/ui-convert-export.png. Full gates and CI are pending.
