# Brand marks, presentation and static subsets

## Brand marks and presentation variants

Register the optional `simple-icons` peer package as the `brand` set:

```js
import { registerIconSet } from '@link-foundation/ui-components/icons';
import { createSimpleIconsSource } from '@link-foundation/ui-components/icons/adapters/simple-icons';
registerIconSet('brand', createSimpleIconsSource());
```

```lino
icon
  set brand
  name github
  label true

icon
  set lucide
  name star
  fill current
  stroke-width 2
  size 1em
```

`label=true` uses the library title (GitHub); absent, empty or `false` labels
are decorative. Explicit labels override the title. Simple Icons marks are
filled in currentColor on a 24×24 grid. CC0 records include a trademark
notice; the build ships LICENSE.md and DISCLAIMER.md. Withdrawn names such
as `linkedin` and a missing peer package produce a placeholder and a warning
naming the brand. Use a consumer-registered set for a custom mark. Adapter
sources accept `onDiagnostic(diagnostic)` to collect missing-icon warnings.

`fill="current"` fills stroke drawings with currentColor. `stroke-width`
accepts finite numbers from 0.5 to 3; omission preserves the library width.
`size` sets `--ui-icon-size`: use a nonnegative CSS length (`1em`, `24px`),
`0`, a custom-property token (`space-medium`, `--space-medium`), or
`var(--space-medium)`. Invalid values are ignored and emit a bubbling
`ui-icon-diagnostic` event with `{code, attribute, value}`. Removing the size
attribute restores the previous inline custom property.

## Static app subsets

A names manifest selects exactly the listed icons, including library names
beyond `ICON_NAMES`. Quote `SET:NAME` references because `:` is LiNo syntax:

```lino
icons
  'brand:github'
  'lucide:star'
  'lucide:heart'
```

```sh
node scripts/build-icons.mjs --names app-icons.lino --out dist/app-icons
```

The manifest replaces the default selection; without `--names`, the usual
full logical sets are built. Unknown names fail together before any output
is written. The selected sets emit static modules and sprites, NOTICE.lino,
ATTRIBUTION.md and library licence files. The checked-in own runtime module
is never replaced by a subset. Register each generated module with
`registerIconSet(data.set, createStaticSource(data))`: the consumer needs no
runtime icon package resolver. Adapter source `names` mappings remain
additive and accept extra library names.

For a runnable static consumer with English/Russian inline messages:

```sh
node scripts/build-icons.mjs --names packages/ui-components/examples/inline-icons.lino --out packages/ui-components/dist/icons/inline
node scripts/serve-static.mjs
```

Open `/packages/ui-components/examples/inline-icons.html`. See
[ui-i18n message parts](../ui-i18n/README.md#inline-icon-message-parts).
