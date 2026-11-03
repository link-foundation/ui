---
'@link-foundation/ui-components': minor
'@link-foundation/ui-dom': minor
'@link-foundation/ui-core': patch
---

Add `@link-foundation/ui-components`: behaviour state machines written in LiNo (`initial`, `context`, flat states with `on`/`target`/`do`/`when`, `entry`, `exit`, `after` delays on an injected clock, and `parts` with `attr` and `key`), `parseMachine` with diagnostics and a DOM-free `interpret` (`./behavior`); `createActionRegistry` with the vocabulary defaults, where unknown actions are diagnostics and `navigate` rejects `javascript:` URLs; the `toggle` and `disclosure` reference machines; `mountBehavior` for ui-dom documents (`./behavior/dom`); and accessibility helpers (`./a11y`): focus trap, roving tabindex, typeahead, key bindings, a live region announcer and `bindMachine`. ESLint forbids `eval`, `new Function` and string timers in the package. ui-dom gains an `isAction` render option so registered actions outside the vocabulary are dispatched; ui-core's vocabulary gains the `machine` kind.
