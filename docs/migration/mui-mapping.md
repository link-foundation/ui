# MUI to framework mapping

Use this manual guide with the [playbook](playbook.md) and
[checklist](checklist-template.md); the [index](README.md) links example pairs.
Source API names were checked against **Material UI 9.5.0 (major 9)** on
2026-11-03: [versions](https://mui.com/material-ui/getting-started/versions/),
[Button API](https://mui.com/material-ui/api/button/) and
[theming](https://mui.com/material-ui/customization/theming/).
For an older target (such as deep's MUI 6), use its locked version's docs;
do not upgrade the source application just to migrate it.

## Components

These are LiNo kind names, not PascalCase JavaScript exports. The
[package entry point](../../packages/ui-components/src/index.js) re-exports
`controlKindNames`, `CONTROL_KIND_SPECS`, `controlsVocabulary`,
`layoutVocabulary`, `overlayVocabulary` and `dataVocabulary`. Those catalogs
and the registered DOM kinds are the source of the names below.
Import layout, overlays and data to register their renderers, and call
`registerControls()` for controls. `text` is a core kind included in the
exported vocabularies. All translations need behavior and visual review;
sharing a kind name does not promise complete MUI API parity.

| MUI component      | Framework element           | Notes                                                                                            |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------------------------ |
| Button             | `button`                    | #34; label and press action.                                                                     |
| IconButton         | `icon-button`               | #34; supply an accessible `label`.                                                               |
| TextField          | `text-field`                | #34; multiline uses `text-area`.                                                                 |
| Checkbox           | `checkbox`                  | #34; `checked` also accepts `mixed`.                                                             |
| Switch             | `switch`                    | #34; `checked` is boolean.                                                                       |
| Radio / RadioGroup | `radio` / `radio-group`     | #34; group owns value/name.                                                                      |
| Select             | `select`                    | #34; children are `option` links.                                                                |
| Slider             | `slider`                    | #34; min/max/step/value.                                                                         |
| Autocomplete       | `combobox`                  | #34; review free-solo/multiple gaps.                                                             |
| Typography         | `text`                      | Core; style typography; preserve heading semantics in host.                                      |
| Box                | `stack`                     | #36; flex container, not polymorphic HTML.                                                       |
| Stack              | `stack`                     | #36; row → horizontal, column → vertical.                                                        |
| Grid               | `grid`                      | #36; explicit tracks; no automatic 12-column prop mapping.                                       |
| Container          | no equivalent yet           | [#164](https://github.com/link-foundation/ui/issues/164); keep host width wrapper.               |
| Paper              | no equivalent yet           | [#164](https://github.com/link-foundation/ui/issues/164); surface styles alone are partial.      |
| Card               | no equivalent yet           | [#164](https://github.com/link-foundation/ui/issues/164); retain composition.                    |
| Dialog             | `dialog`                    | #35; title/body/actions, native modal focus.                                                     |
| Menu               | `menu`                      | #35; translate trigger, anchor and items manually.                                               |
| Popover            | `popover`                   | #35; review anchor/placement and dismissal.                                                      |
| Tooltip            | `tooltip`                   | #35; preserve accessible trigger relationship.                                                   |
| Snackbar           | `toast`                     | #35; use queue API for transient messages.                                                       |
| Tabs               | `tabs`                      | #35; use documented tab/panel relationships.                                                     |
| AppBar             | no equivalent yet           | [#164](https://github.com/link-foundation/ui/issues/164); app-shell is navigation, not AppBar.   |
| Drawer             | `drawer`                    | #35; review side, modality and focus.                                                            |
| List               | `list`                      | #37; items/template data API, not arbitrary ListItem JSX.                                        |
| Table              | `table`                     | #37; columns/items API; preserve caption and selection.                                          |
| Avatar             | `avatar`                    | #34; `src` → `source`, fallback `name`.                                                          |
| Chip               | no equivalent yet           | [#164](https://github.com/link-foundation/ui/issues/164); badge has no removal behavior.         |
| Badge              | `badge`                     | #34; badgeContent → value; host owns overlay placement.                                          |
| CircularProgress   | `progress` (semantics only) | [#164](https://github.com/link-foundation/ui/issues/164); no circular equivalent yet.            |
| LinearProgress     | `progress`                  | #34; omit value for indeterminate.                                                               |
| Accordion          | no equivalent yet           | [#164](https://github.com/link-foundation/ui/issues/164); disclosure machine is not a component. |

Basic controls came from [#34](https://github.com/link-foundation/ui/issues/34),
overlays from [#35](https://github.com/link-foundation/ui/issues/35), layouts
from [#36](https://github.com/link-foundation/ui/issues/36) and data display
from [#37](https://github.com/link-foundation/ui/issues/37). Gap rows link the
upstream feature issue; keep the old implementation while it remains open.
The smaller [generated #48 mapping](../themes/material3.md) lists only its
explicit prop translations, not every manual composition described here.

## Props

Each row has a JSX source line and a LiNo target line. Parentheses are used in
these table cells to keep them on one line; files use the nested form.
`emit` delegates to the host. A style link is a named ui-style rule, not an
`sx` object. Unsupported details must remain in a compatibility adapter or be
tracked upstream; do not invent attributes such as `(fullWidth true)`.

| MUI JSX line                                                 | LiNo line                                                     | Translation                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `<Button variant="contained">Save</Button>`                  | `(save: button (label Save) (variant filled))`                | contained → filled; outlined/text retain their names.                   |
| `<Button variant="outlined">Save</Button>`                   | `(save: button (label Save) (variant outlined))`              | Explicit outline.                                                       |
| `<Button variant="text">Save</Button>`                       | `(save: button (label Save) (variant text))`                  | Explicit text variant.                                                  |
| `<Button color="secondary">Save</Button>`                    | `(save: button (label Save) (style secondary-action))`        | No button color prop; use semantic tokens in a style.                   |
| `<Button size="small">Save</Button>`                         | `(save: button (label Save) (style compact-action))`          | No button size prop; style padding/font size and verify hit area.       |
| `<Button disabled>Save</Button>`                             | `(save: button (label Save) (disabled true))`                 | Native disabled behavior.                                               |
| `<Button fullWidth>Save</Button>`                            | `(save: button (label Save) (style full-width-action))`       | Stretch parent; rule fills native root.                                 |
| `<Button startIcon={<Add />}>Add</Button>`                   | `(add: button (label Add) (icon plus))`                       | Leading logical icon; see registry below.                               |
| `<Button endIcon={<Send />}>Send</Button>`                   | `(send: button (label Send) (icon send))`                     | Semantic fallback is leading; trailing placement has no equivalent yet. |
| `<Button onClick={saveDocument}>Save</Button>`               | `(save: button (label Save) (on press (emit save-document)))` | Host handles the named event.                                           |
| `<Button sx={{ p: 2 }}>Save</Button>`                        | `(save: button (label Save) (style padded-action))`           | Resolve spacing and define a style rule manually.                       |
| `<TextField slotProps={{ htmlInput: { name: 'email' } }} />` | `(email: text-field (name email))`                            | Promote supported native field props; arbitrary slots are not copied.   |

`color`, `size` and `fullWidth` are component-specific: avatar has a real
`size` enum (`small`, `medium`, `large`), but button does not. Check the
[control vocabulary](../../packages/ui-components/src/controls/kinds.lino)
before moving a prop. Leading `icon` does not preserve `endIcon` placement;
retain the old wrapper if placement is part of the visual contract.

For `slotProps`, use the supported control property when possible. Rewrite
visual slot overrides as theme part styles/templates using the existing
`data-part` contract. Arbitrary slot components, event handlers and native
attributes need a reviewed host adapter or an upstream issue; there is no
general `slotProps` LiNo attribute. See
[MUI's slot model](https://mui.com/material-ui/customization/overriding-component-structure/)
and [framework template boundaries](../spec/themes.md).

For the style examples above, these rules use the implemented
[#20 style API](../../packages/ui-style/README.md). Load/compile them with
ui-style, or place them inside a theme. If migrating `sx`, expand shorthands,
resolve theme functions and responsive values deliberately. Override links
from ui-config can change a known property or token; they do not execute `sx`.

```lino
secondary-action: style
  selector
    data-part root
    within
      type button
      style secondary-action
  background
    token color.secondary
  color
    token color.on-secondary
compact-action: style
  selector
    data-part root
    within
      type button
      style compact-action
  padding 8px 12px
  font-size 14px
padded-action: style
  selector
    data-part root
    within
      type button
      style padded-action
  padding 16px
full-width-action: style
  selector
    data-part root
    within
      type button
      style full-width-action
  min-width 100%
```

The `style` property is matched explicitly by each selector above. Style the
native `data-part root`, since styling only the custom-element host does not
replace the native button's own fill or padding. For `fullWidth`, put the
styled button in a vertical `stack` with `align stretch`; this stretches the
host, and the rule's `min-width 100%` fills it with the native button.

A complete action line in the normal file format:

```lino
save: button
  label Save
  variant filled
  on press
    emit save-document
```

## Theme

The [#47 theme engine](../spec/themes.md) loads named themes, `extends`, mode
blocks and nested element boundaries. Tokens become CSS custom properties;
they do not automatically apply every imported scale to every component.

| MUI theme key                         | Framework target                           | Application                                         |
| ------------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `palette.primary.main`                | `color.primary`                            | Other palette roles map to semantic color tokens.   |
| `palette.mode`                        | Theme `scheme` metadata; boundary `scheme` | Apply light/dark to the mounted boundary.           |
| `typography.fontFamily`               | `type.font-family`                         | Font-family token, not a bundled font.              |
| `shape.borderRadius`                  | `shape.corner.small`                       | Numeric pixels; review component corner scale.      |
| `spacing`                             | `space.unit`                               | Numeric base in pixels; multiply per use.           |
| `breakpoints.values`                  | `breakpoint.xs`, `.sm`, etc.               | Values in pixels; wire responsive rules explicitly. |
| `components.MuiButton.styleOverrides` | `style` links                              | Manual translation; converter reports these leaves. |

Automated theme conversion is implemented by [#48](../themes/material3.md):
call `muiThemeToLino(options, { id: 'app-theme' })` from
`@link-foundation/ui-themes`. Pass plain `createTheme` options, review both
`lino` and `unmapped`, and load the result alongside `material3` and its
parents. Unknown leaves, functions and arrays are reported, not executed;
`components.*.styleOverrides`, `sx` and JSX need manual translation. The
[#59 JSX/MUI importer](../../packages/ui-convert/README.md) is a separate,
optional tool, not a prerequisite for this manual path.

```lino
app-theme: theme
  extends material3
  token color.primary '#1976D2'
  token type.font-family 'Arial, sans-serif'
    type fontFamily
  token shape.corner.small 4px
  token space.unit 8px
  token breakpoint.sm 600px
  mode dark
    token color.primary '#90CAF9'
  style
    selector
      data-part root
      within
        type button
    radius
      token shape.corner.small
```

For `spacing: 8`, MUI `spacing(2)` or `sx={{ p: 2 }}` becomes `16px`, not
`2px` and not a raw function token. Preserve each expanded value when the
source spacing is a function or array. Breakpoint tokens store thresholds;
they do not recreate MUI Grid's responsive props automatically.
`styleOverrides.root.borderRadius` becomes the `radius` declaration above;
translate other properties only if ui-style supports them.

Apply `theme app-theme` and `scheme dark` (or `scheme system`) on a document
or subtree. A nested boundary can select another theme/scheme; it does not
need a second React provider. The converter writes dark palette overrides
inside `mode dark`; selecting dark metadata alone does not set DOM boundary
attributes. Preserve initial-paint settings with the documented boot API.

## Icons

MUI's [Material Icons](https://mui.com/material-ui/material-icons/) originate
from Google's Apache-2.0 icon set. Retain the icon licence and any upstream
NOTICE, plus the framework's generated modification notice. The MIT React
wrapper does not erase the SVG artwork's licence. Follow the
[asset policy](../licensing.md) when carrying artwork into the target.

Use the [#44 registry](../../packages/ui-components/README.md#icons) logical
names: MUI `Add` → `plus`, `Close` → `close`, `MoreHoriz` → `more`,
`ContentCopy` → `copy`, `Send` → `send`. The
[Material Symbols adapter](../../packages/ui-components/src/icons/adapters/material-symbols.js)
resolves these to `add`, `close`, `more_horiz`, `content_copy`, `send`.
Material Symbols is a successor set, so compare its geometry with the old
Material Icons baseline; matching a name alone does not preserve pixels.

Register `createMaterialSymbolsSource()` with `registerIconSet('material-symbols', source)`
and use a qualified reference such as `material-symbols:plus` (or an icon
element with `set material-symbols`). Use only the icons
the application needs; the pipeline emits asset records and LICENSE/NOTICE
files. Verify missing-name diagnostics and include an accessible label on
icon-only actions. The [button-row example](examples/mui-button-row.lino)
avoids external artwork so it needs no additional asset dependency.

## Appendix: Chakra v2/v3

Check the target lockfile first. Chakra v2 uses
`<ChakraProvider theme={extendTheme(options)}>`; v3 uses
`createSystem(defaultConfig, config)` and `<ChakraProvider value={system}>`,
with token values wrapped in `{ value: ... }`. These are distinct source
shapes; migrating to this framework does not require a v2-to-v3 upgrade.
See Chakra's official [migration guide](https://chakra-ui.com/docs/get-started/migration)
and [semantic tokens](https://chakra-ui.com/docs/theming/semantic-tokens).

| Chakra source                    | Framework target                          | Notes                                      |
| -------------------------------- | ----------------------------------------- | ------------------------------------------ |
| v2 ChakraProvider / extendTheme  | Named `theme`, `extends`, element `theme` | Preserve scope and defaults.               |
| v3 ChakraProvider / createSystem | Same theme boundary                       | Extract data; do not run config callbacks. |
| semanticTokens light/\_dark      | Base tokens / `mode dark`                 | Preserve semantic names and aliases.       |
| Button / IconButton              | `button` / `icon-button`                  | v2 isDisabled / v3 disabled → disabled.    |
| Input / Textarea                 | `text-field` / `text-area`                | Preserve labels and commit timing.         |
| Checkbox / Switch                | `checkbox` / `switch`                     | v2 isChecked / v3 checked → checked.       |
| Select / Slider                  | `select` / `slider`                       | Rebuild compound slots and callbacks.      |
| Box / Flex / Stack / Grid        | `stack` / `grid`                          | Expand shorthand/layout units.             |
| Text / Heading                   | `text`                                    | Host preserves semantic heading level.     |
| Modal (v2) / Dialog.Root (v3)    | `dialog`                                  | v2 isOpen / v3 open → open; test focus.    |
| Menu / Tooltip / Tabs            | `menu` / `tooltip` / `tabs`               | Adapt compound parts manually.             |
| Drawer / Toast                   | `drawer` / `toast`                        | Recheck modality and queue behavior.       |

Start deepcase at
[`imports/theme/theme.tsx`](https://github.com/deep-foundation/deepcase/blob/main/imports/theme/theme.tsx):
its v2 theme uses `cssVarPrefix: 'deepCase'` and light/dark semantic tokens
including `backgroundModal` and `text`. Preserve the existing generated
variable names through an explicit alias bridge rather than assuming token
path normalization recreates Chakra's prefix/casing. The
[deepcase research](../case-studies/issue-1/research/deepcase.md#6-theming)
records the baseline values; compare them with the pinned target revision.

For formal-ai, begin at
[`js/app/theme.js`](https://github.com/link-assistant/formal-ai/blob/main/js/app/theme.js).
Its v3 `createSystem` bridge points Chakra semantic tokens at existing `--fa-*`
variables and disables preflight/global CSS to preserve the old page;
keep those names while moving their values to LiNo. For example, a token path
`fa.surface.card` emits `--fa-surface-card`. Preserve v2 `default`/`_dark`
or v3 conditional `value` objects as base and dark-mode declarations, then
keep the old provider bridge until all consumers use the framework. See the
[formal-ai research](../case-studies/issue-1/research/formal-ai.md).

There is no Chakra-to-LiNo converter promised here. Apply the same contracts,
settings/i18n adapters, screenshots and deletion gates as the MUI path.
