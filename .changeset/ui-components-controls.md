---
'@link-foundation/ui-components': minor
---

Add the basic controls to `@link-foundation/ui-components` (entry points `./controls` and `./controls.css`, also exported from the package root): `button`, `icon-button`, `label`, `link`, `text-field`, `text-area`, `number-field`, `color-field`, `checkbox`, `radio-group` and `radio`, `switch`, `slider`, `select`, `combobox` and `option`, `progress`, `badge` and `avatar`. Each is a ui-dom kind over native elements with its WAI-ARIA pattern (keyboard, roles and states), a LiNo behaviour machine when it has state, stories in `stories/<kind>.lino` and a catalog entry. `mountControls` writes every committed value to the store in one transaction before the `(on change ...)` handlers run, the input controls submit with their native form, and `controls.css` uses only design tokens.
