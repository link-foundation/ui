---
'@link-foundation/ui-devmode': minor
---

Add `@link-foundation/ui-devmode`: the development/configuration mode inspector. `mountDevMode({ root, config, policy })` installs the entry points the site policy allows: `Alt+Shift+D` (by `event.code`, ignored in text fields), `?ui-dev` and `<ui-dev-mode>`. It loads the overlay and inspector with a dynamic `import()` only when dev mode opens, and never with `(enabled false)`. The overlay labels and selects elements without delivering the click to the app. The inspector, docked right in a shadow root, has Outline (WAI-ARIA tree), Properties (typed editors with the winning layer and reset), Styles, Tokens, Animations and Source tabs. Edits write the session layer, Save moves them to the persisted user layer, and Discard and Reset are supported. Locked elements stay read-only, and `globalThis.linkUiDevMode` exists while dev mode is open.
