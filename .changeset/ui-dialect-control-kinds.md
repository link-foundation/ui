---
'@link-foundation/ui-core': minor
'@link-foundation/ui-dom': minor
'@link-foundation/ui-convert': minor
'@link-foundation/ui-devmode': patch
---

Add the basic control kinds to the ui-dialect vocabulary (`docs/spec/vocabulary.lino` and its `ui-core` copy): `icon-button`, `label`, `link`, `text-field`, `text-area`, `number-field`, `color-field`, `checkbox`, `radio-group`, `radio`, `switch`, `slider`, `select`, `combobox`, `option`, `progress`, `badge` and `avatar`. ui-dom maps the UI event `change` to the `ui-change` event a control dispatches once per committed value, and gives a kind renderer `ctx.children()`, the element models of its children. With these kinds in the vocabulary, the ui-convert HTML import maps `<a>`, text `<input>`, checkbox `<input>` and `<textarea>` to `link`, `text-field`, `checkbox` and `text-area` (keeping their attributes and styles), and the ui-devmode inspector edits `element-ref-or-url` properties as text.
