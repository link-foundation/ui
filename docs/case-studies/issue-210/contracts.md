# Control and settings integration contracts

This implements the contracts reported in [issue 210](https://github.com/link-foundation/ui/issues/210)
without copying the consumer site's code. The select keyboard behavior follows
the [APG select-only combobox example](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/).

## Select integration

```lino
palette: select Palette
  external-label true
  aria-label 'My colour'
  list-label 'Options: My colour'
  menu-min-width 280
  menu-max-height 320
  value ocean
  ocean: option Ocean
  sand: option Sand
    disabled true
```

Menu dimensions are CSS pixels. The menu is at least the anchor width and the
configured minimum, bounded by the viewport. Height is bounded by available
space and the configured maximum (default 320). Resize and scroll observers
run only while open. Native Popover is used when available; otherwise a body
portal with fixed coordinates escapes clipping ancestors. Portals are removed
on destroy. The portal copies inherited theme custom properties when it is created.

`external-label` clears the generated label. Set either `aria-label` or
`aria-labelledby` from the host's localized label, plus a distinct `list-label`
or `list-labelledby`. The popup is outside the enclosing label, including
while hidden, so DOM label queries cannot collect option text. Naming remains
independent of the selected value. React hosts can set these LiNo properties
through the same store API as any other control property; no DOM patching is
needed. Label references must identify persistent host label nodes.

Disabled and hidden options ignore clicks. Pointer activation focuses the
trigger explicitly. Tab and Shift+Tab commit the active option and allow native
focus movement; Escape cancels. Page keys move ten available options and clamp
at the ends. Arrow keys and typeahead retain their existing contracts.

## Editors

Number fields commit on `input`. Valid values update live while their exact
text draft survives the store echo (`1.`, trailing zeroes). Invalid intermediate
text keeps the last numeric value. Empty text commits null, represented by an
absent value property. Change finalizes formatting; Escape restores the committed
value. `(fallback 5)` supplies the base for stepping an inherited empty value.
The `increment` and `decrement` buttons and Arrow keys step; Shift+Arrow keys
multiply by ten. Page keys step ten times. Home, End and Shift+Page keys retain
native text editing behavior. Disabled and readonly fields cannot step or commit.

Color text accepts hex and integer `rgb(r, g, b)` values (0–255), normalizing to
`#rrggbb`. The native picker is optional convenience; named palette buttons are
keyboard accessible:

```lino
accent: color-field Accent
  value '#1256ab'
  palette
    Ocean '#1256ab'
    Sand '#eecbaa'
```

## Panel extensions

Field schema clauses are parsed by the official LiNo reader into `field.props`:

```lino
appearance: section
  label Appearance
  tabs Basic Advanced
frame.enabled:
  type toggle
  default true
  section appearance
frame.width:
  type number
  default 4
  min 0
  max 20
  section appearance
  tab Advanced
  level expert
  group Dimensions
  visible-when frame.enabled true
  preview frame
```

`visible-when key value` compares a setting to an atom. Nested `all`, `any` and
`not` combine conditions; a key alone tests truthiness. Visibility composes with
search, tabs and the selected level. Rows are mounted once, including initially
hidden rows. `setTab(section, tab)` and `setLevel(level)` refresh them. Tabs have
native keyboard-operable buttons with pressed state. An unselected level shows
all levels. `(group name)` uses a fieldset/legend. `columns: 2` arranges entire
sections into a responsive grid, preserving section DOM order on narrow screens.

`createSettingsPanel(schema, options)` accepts:

- `mountControl(container, field, value, onChange, id)` returns
  `{ update(value), destroy() }`, replacing the default field editor.
- `mountPreview({ container, field, values })` returns
  `{ update(values, field), destroy?() }` for fields with a `preview` clause.
  Hosts can render transparent frame/material previews without changing their
  controls; preview lifetimes follow the panel.
- `project(values)` derives CSS/attributes for `previewRoot`.
  `onPreview(values, root)` can render a more complex preview.
- `normalizeChanges(next, changes)` enforces coupled limits before validation
  and before writing to the target; for example, cap width to a fit limit.
- `formatCount(model)` localizes/customizes counts without changing search or
  engine equality. `model.changedCount` includes hidden/filtered settings;
  `visibleCount` counts visible rows.
- `randomLocked` excludes keys from randomization; comfort fields remain locked
  automatically. `normalizeChanges` also constrains randomized results.
- `savedLooks` and `onLooksChange` load/persist named looks in host storage.
  `saveLook`, `applyLook`, and `applyShared` expose the same actions as the UI.
  Shared/named looks preserve current comfort settings. The first successfully
  applied share captures a recoverable before-link snapshot;
  `restoreBeforeLink` restores its appearance while preserving current comfort.
  `sharedHash` applies an initial link through that path.
- `codec: { read, write }` adapts import/export to existing storage formats.
  Default import reads LiNo or legacy JSON with schema validation; export writes
  LiNo. Copy/paste, file import/export and `importText`/`exportText` use the same
  validation paths. Invalid input is rejected atomically.

## Engine interoperability

`readSchema(text, { normalization: { primitives: 'strict', numbers: 'clamp' } })`
rejects wrong JSON primitive types and clamps continuous numbers without snapping
imports to the step. Defaults remain permissive primitive coercion and step
snapping. Schema/default/preset and values-document atoms are still read as LiNo
atoms and normalized before strict runtime merging. `coerce(field, raw, policy)`
also accepts an explicit policy. `(nullable true)` permits null on a field;
`(default null)` represents an inherited default and round-trips as LiNo.

`createSettingsCodec(schema, { decode, encode })` wraps a host's existing codec.
`read(text, { base, look })` validates values and optionally applies a comfort-safe
look. `write(values)` encodes only differences from defaults. Use the official
`lino-objects-codec` decoder/encoder for an existing `settings:` object-codec
payload; the framework does not parse that format with regular expressions.
The host retains its existing storage key and codec version.

`applyToRoot(schema, values, root, { project })` writes changed declarations
only. Nullable values remove their CSS variables and data attributes.
`project(values)` returns `{ css, attributes }`; null removes a declaration.
Resolve corner inheritance and derive RGB/noise tokens here from the same
normalized values used by controls, instead of maintaining a second engine.

`beforePaintScript(schema, { storageKey, readStorage, project })` can read the
same compatibility format before the first paint. Both hooks are serialized
JavaScript: they must be standalone functions, or call globals installed by a
prior synchronous script. Bundle the official object-codec decoder with its
LiNo parser into that prior script; then `readStorage: text =>
globalThis.settingsCodec.decode(text)` uses it. No asynchronous import or second
normalization engine is required. `project` receives all normalized fields,
including defaults for invalid stored values. Use the same projection at runtime
and before paint. With the default snapshot format, write `paintSnapshot(schema, values,
{ includeAll: true })` when the projection uses fields without apply targets.
The generated script is safe inside a script element and its
CSP hash includes both hooks. Treat hook code as trusted application code.

## Directional stepping and localized editors

`nextValue(key, { value, min, max, step, snapping: 'directional' })` takes the
first grid tick in the requested direction rather than rounding to the nearest
tick before stepping. For `value: 0.075, step: 0.01`, ArrowUp returns `0.08` and
ArrowDown returns `0.07`. Page/Shift multiples include that first tick. Omit
`snapping` or use `'nearest'` for the existing behavior. Number controls accept
the same `snapping` property and `increment-label` / `decrement-label` for
field-specific localized accessible names.

Color controls accept `rgb true` to show a grouped red/green/blue chooser with
keyboard sliders and integer editors (0–255). All channels, the text editor,
native picker and palette share one normalized hex value. `rgb-label`,
`red-label`, `green-label`, `blue-label` and `palette-label` name these controls
independently; disabled/readonly fields disable the channel controls. Panel
color editors enable the chooser by default; set the field's `rgb false` to hide it.

`createSettingsPanel(schema, { messages })` accepts a partial catalog whose keys
are typed by `SettingsMessageKey`. Values are strings or functions receiving
structured `{ label, count, keys }` parameters. Missing keys use English defaults.
Functions may call the host's ui-i18n formatter; the panel adds no language
registry or parsing convention. The catalog covers toolbar, search, counts,
reset confirmations, share/import/export statuses, saved looks, collection
actions and field-specific editor names. `formatCount` still takes precedence
over the catalog's `count`. Schema labels, tab names, presets and palette names
are supplied by the host.

```js
const panel = createSettingsPanel(schema, {
  messages: {
    settings: 'Настройки',
    search: 'Поиск настроек',
    increment: ({ label }) => `Увеличить ${label}`,
    decrement: ({ label }) => `Уменьшить ${label}`,
  },
});
panel.setMessages(englishCatalog);
```

`setMessages` replaces the catalog and updates existing chrome, current status
and editor names without replacing the panel or losing values/saved looks.
Custom controls retain their existing lifecycle and can use the host's catalog.

## Continuous typed values

Typed-value normalization is independent of key snapping. Pass
`readNumber('0.075', { min: 0, max: 1, step: 0.01, normalization: 'clamp' })`
to retain `0.075`. The standalone number-field property is `normalization clamp`;
omit it or use `normalization snap` to keep the original step-snapped behavior.
Both live drafts and committed text use this policy. Empty text still yields
null; invalid/non-finite text keeps the last value. Combine with `snapping
directional` so ArrowUp/pointer increment reaches `0.08` without first
quantizing a typed value. The two policies can be chosen independently.

Generated number editors inherit `field.normalization.numbers`, set by
`readSchema(text, { normalization: { numbers: 'clamp' } })`, so the panel sends
continuous values to the same engine and preview rather than quantizing them
in the editor. The `continuous-number.test.js` regressions fail before the fix
and cover the public reader, live drafts/commits/clear/fallback stepping and
actual generated-panel values. Browser tests also read the live store.
