# @link-foundation/ui-settings

The settings engine of the associative UI framework. One settings schema,
written in Links Notation, gives:

- coercion of every value (clamping, rounding, rejecting unknown options);
- merging of untrusted values (storage, links, documents) that never throws;
- diff-only values documents and share links (`#settings=…`);
- presets and the active preset, randomised looks with locked keys;
- versioned migrations, readers for the share links of the earlier sites;
- application to `<html>` (CSS variables, data attributes) and a before-paint
  script with its CSP hash;
- a test helper that fails when a setting is read by nothing;
- binding to the `user` layer of [`@link-foundation/ui-config`](../ui-config/README.md).

Settings schemas, values documents and share links are parsed with the
official [`links-notation`](https://github.com/link-foundation/links-notation)
parser (through `@link-foundation/ui-core`).

```js
import {
  readSchema,
  merge,
  diff,
  toLino,
  toShareHash,
  fromShareHash,
  applyPreset,
  activePreset,
  randomize,
  applyToRoot,
} from '@link-foundation/ui-settings';

const { schema, diagnostics } =
  readSchema(`(settings-schema: schema (version 2))
(appearance: section (label 'Appearance'))
(liquid.blur: (type range) (default 18) (min 0) (max 40) (step 1) (unit px)
  (section appearance) (label 'Blur') (apply (css-var --liquid-blur)))
(theme.mode: (type choice) (default auto) (options auto light dark)
  (section appearance) (apply (data-attr theme-mode)))
(motion.reduce: (type toggle) (default false) (section appearance) (comfort))
(accent: (type color) (default '#3390EC') (apply (css-var --accent)))
(preset calm (label 'Calm') (set liquid.blur 24) (set theme.mode dark))
(migration (from 1) (to 2) (rename blur liquid.blur) (old-default liquid.blur 12))`);
// schema.fields.size === 4, diagnostics: []

const { values, rejected } = merge(schema, undefined, {
  'liquid.blur': 24,
  evil: 'x',
  'theme.mode': 7,
});
// rejected: ['evil', 'theme.mode']

toLino(schema, diff(schema, values)); // (settings (version 2) (liquid.blur 24))
toShareHash(schema, values); // #settings=(settings%20(version%202)%20(liquid.blur%2024))
fromShareHash(schema, location.hash, values); // { ok, format, values, rejected, version, diagnostics }

activePreset(schema, applyPreset(schema, values, 'calm')); // 'calm'
randomize(schema, values, { random: Math.random, locked: ['accent'] });
applyToRoot(schema, values); // --liquid-blur: 24px; data-theme-mode="auto"
```

The complete example is `examples/ui-settings-basics.mjs` in the repository.

## Schema grammar

A schema is a list of top-level links. Each link is written either
`(id: kind clauses…)` or `(kind id clauses…)`; a link with an id and no kind
is a setting.

```
schema    = (id: schema (version N))
section   = (id: section [(label 'Text')] [(description 'Text')])
setting   = (key: (type T) (default V…) clause…)
          | (key: setting (type T) (default V…) clause…)
preset    = (preset id [(label 'Text')] [(description 'Text')] (set key V…)…)
migration = (migration (from N) (to M) (rename old new)… (old-default key V…)…)
```

Clauses of a setting:

| Clause                                  | Meaning                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `(type T)`                              | `range`, `number`, `toggle`, `choice`, `color`, `text` or a type added with `defineFieldType`.                                                         |
| `(default V…)`                          | The default; it must coerce without change (`(default 99)` above `max` is an error).                                                                   |
| `(min N)` `(max N)` `(step N)`          | Bounds and step of `range` (required: `min`, `max`) and `number`; values are clamped and rounded to the step grid that starts at `min`.                |
| `(unit U)`                              | Appended to the CSS value (`24px`).                                                                                                                    |
| `(options a b c)`                       | The options of `choice` (required).                                                                                                                    |
| `(label 'Text')` `(description 'Text')` | For generated settings panels.                                                                                                                         |
| `(section id)`                          | The section of the setting (an unknown section is a warning).                                                                                          |
| `(comfort)`                             | A comfort setting: kept from the viewer when a shared look is opened, never randomised, ignored by `activePreset`. Presets that set one get a warning. |
| `(apply (css-var --name))`              | Set as a CSS custom property on `<html>`.                                                                                                              |
| `(apply (data-attr name))`              | Set as the attribute `data-name` on `<html>`.                                                                                                          |
| anything else                           | Kept in `field.props` for custom types.                                                                                                                |

Keys are names such as `liquid.blur` (letters, digits, `.`, `-`, `_`).
`readSchema` never throws: problems are diagnostics (`missing-type`,
`unknown-type`, `missing-default`, `bad-default`, `missing-range`,
`missing-options`, `duplicate-key`, `bad-key`, `unknown-key`, `bad-value`,
`bad-migration`, `bad-version`, `unknown-link`, `unknown-section`,
`preset-sets-comfort`, `missing-schema-version`, syntax errors), and fields
with errors are left out of the schema.

### Field types

| Type     | Value                    | Raw values accepted                            | Random             |
| -------- | ------------------------ | ---------------------------------------------- | ------------------ |
| `range`  | number in `[min, max]`   | numbers and decimal atoms (`'24'`, `'-0.5'`)   | on the step grid   |
| `number` | number (bounds optional) | same                                           | when bounded       |
| `toggle` | `true` / `false`         | booleans, `'true'`, `'false'`                  | yes                |
| `choice` | one of `options`         | option strings (numbers are compared as text)  | one of the options |
| `color`  | `#rrggbb`                | `#rrggbb` strings (`red`, `#fff` are rejected) | yes                |
| `text`   | string                   | strings and numbers                            | never              |

```js
import { defineFieldType } from '@link-foundation/ui-settings';

defineFieldType('vector3', {
  coerce(field, raw) {
    const parts = (Array.isArray(raw) ? raw : String(raw).split(' ')).map(
      Number
    );
    return parts.length === 3 && parts.every(Number.isFinite)
      ? { ok: true, value: parts }
      : { ok: false };
  },
  equals: (a, b) => a.every((n, i) => n === b[i]),
  random: (field, random) => [random(), random(), random()],
  format: (field, value) => value.map(String), // (light.direction 0 0 1)
});
```

`coerce` is required; `equals` defaults to structural equality, `random` to
"not randomised", `format` to the value as atoms and `css` to the formatted
atoms joined with spaces. A `coerce` that throws counts as a rejected value.

## Values

Values are a plain object with a value for every field. Documents and share
links hold only the values that differ from the defaults:

```
(settings (version 2) (liquid.blur 24))
```

| Function                                        | Result                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `defaults(schema)`                              | Every default.                                                                                                               |
| `merge(schema, base, untrusted)`                | `{ values, rejected }`: unknown keys, `__proto__` and values that do not coerce are rejected. Never throws.                  |
| `diff(schema, values)`                          | Only the changed values, in schema order.                                                                                    |
| `isDefault(schema, key, value)`                 | Whether the value is the default.                                                                                            |
| `reset(schema, values, keys?)`                  | Some keys (default: all) back to the default.                                                                                |
| `countCustomized(schema, values)`               | How many values differ from the defaults.                                                                                    |
| `equalValues(schema, a, b, { skip })`           | Field-by-field equality; key order does not matter.                                                                          |
| `applyPreset(schema, values, id)`               | The values with the preset applied (comfort settings keep their values).                                                     |
| `activePreset(schema, values)`                  | The id of the preset the values match (ignoring comfort settings and key order), or `null`.                                  |
| `randomize(schema, values, { random, locked })` | A random look; `random` is required, so a seeded generator gives the same look every time; comfort and locked keys are kept. |

## Documents and share links

| Function                                                | Result                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `toLino(schema, values)`                                | `(settings (version N) (key value…)…)` of the changed values.                                                         |
| `fromLino(schema, text, { base, look })`                | `{ ok, values, rejected, version, diagnostics }`, migrated to the schema version.                                     |
| `fromLegacyJson(schema, json, { version, base, look })` | The JSON settings of the earlier sites.                                                                               |
| `toShareHash(schema, values)`                           | `#settings=<encodeURIComponent(values document)>`.                                                                    |
| `fromShareHash(schema, hash, viewerValues)`             | Reads `#settings=(settings …)`, `#settings={…}` (konard.github.io) and `#ui={…}` (immortality); `format` tells which. |

Share links carry a shared _look_: when one is opened, every comfort setting
keeps the viewer's value. Hashes longer than `MAX_SHARE_HASH` (8 KiB) are
rejected with the diagnostic `hash-too-large`, and nothing a link holds can
throw: bad encodings, bad JSON and unknown keys become diagnostics and
`rejected` keys.

## Migrations

`(migration (from 1) (to 2) (rename blur liquid.blur) (old-default liquid.blur 12))`
moves version 1 values to version 2:

1. keys are renamed (`blur` → `liquid.blur`);
2. stored values equal to the old default are dropped, so the user gets the
   new default (`(blur 12)` → `liquid.blur 18`, `(blur 30)` → `liquid.blur 30`);
3. the result is merged onto the defaults (or `base`).

Migrations chain (1 → 2 → 3). A shared look from an old version (`look: true`,
used for share links) is different: the sender saw the old defaults, so
missing keys take the old defaults. A newer version than the schema is read
as it is, with the warning `newer-version`.

## Applying values before paint

`applyToRoot(schema, values, root = document.documentElement)` sets the CSS
variables and data attributes of every applied setting (invalid values get the
default).

The first paint must already use the stored values, so the page inlines a
small script at the top of `<head>`:

```js
import {
  beforePaintScript,
  beforePaintScriptHash,
  paintSnapshot,
  PAINT_STORAGE_KEY,
} from '@link-foundation/ui-settings';

const script = beforePaintScript(schema); // <script>${script}</script>
const csp = `script-src '${await beforePaintScriptHash(script)}'`;

// Whenever the values change:
localStorage.setItem(PAINT_STORAGE_KEY, paintSnapshot(schema, values));
```

The script reads a _paint snapshot_ — JSON of the applied values — because the
Links Notation parser is too large to inline before the first paint; the
values documents stay the source of truth. The script checks every stored
value against the schema rules it carries (bounds, steps, options, colour
format), applies the defaults when storage is missing, blocked or corrupted,
never throws, and contains no `</script>` or line separators. Custom field
types are applied with their defaults until `applyToRoot` runs.

## Testing: every setting is used

```js
import { assertEverySettingUsed } from '@link-foundation/ui-settings';

assertEverySettingUsed(schema, {
  css: [readFileSync('src/app.css', 'utf8')],
  sources: [readFileSync('src/app.js', 'utf8')],
});
```

Throws (with `error.unused`, the keys) when a CSS variable or data attribute
of a setting is read by no stylesheet or source, or when a setting without
`apply` is mentioned by no source.

## Configuration layers

Settings values are overrides of the props of one element (default:
`settings`) of a ui-config document, in the `user` layer:

```js
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import { bindConfig } from '@link-foundation/ui-settings';

const config = createConfig({
  document: parse(`(app: document
  (settings: group))`),
});
const settings = bindConfig(config, schema); // { target: 'settings', layer: 'user' }
settings.update({ 'liquid.blur': 24, 'theme.mode': 'dark' }); // one patch
settings.subscribe((values) => applyToRoot(schema, values));
config.exportPatch();
// (user-overrides: overrides
//   (layer user)
//   (base app)
//   (set settings liquid.blur 24)
//   (set settings theme.mode dark))
```

`values()` reads every layer (invalid overrides fall through to the layer
below), `set`/`update` write one patch and unset values equal to the layers
below, `reset(keys?)` removes the overrides. `bindConfig` throws when the
document has no target element.

## Migration guide

### From immortality (`#ui=` JSON)

The immortality site keeps `{ v: 2, palette, glow, cornerSize, … }` in
storage and in `#ui=<encodeURIComponent(JSON)>` links.

1. Write the settings as a schema with `(version 2)`; mark `animations`,
   `sound` and `volume` as `(comfort)`.
2. Write the defaults of the unversioned links as
   `(migration (from 1) (to 2) (old-default palette mission) …)` (the
   `LEGACY_V1_BASE` object of the site).
3. Read stored JSON with `fromLegacyJson(schema, json)` (`v` is the version,
   an object without `v` is version 1) and store `toLino(schema, values)`.
4. Read links with `fromShareHash(schema, location.hash, viewerValues)`:
   `#ui=` links open as before, the viewer's comfort settings win.
5. Write links with `toShareHash`.

### From konard.github.io (`#settings=` JSON)

The site keeps flat dotted keys (`{ "liquid.blur": 24 }`) in storage and in
`#settings=<encodeURIComponent(JSON)>` links, without a version.

1. Use the dotted keys as setting keys; the JSON has the schema's version.
2. Read stored JSON with
   `fromLegacyJson(schema, json, { version: schema.version })`.
3. `fromShareHash` tells the old links (`format: 'konard-json'`) from the new
   ones (`format: 'lino'`) by their first character, so both keep working
   under the same `#settings=` parameter.
4. Replace the inline theme script with `beforePaintScript(schema)` and its
   CSP hash.

## License

[Unlicense](LICENSE)
