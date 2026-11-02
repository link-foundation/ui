# @link-foundation/ui-convert

Converters between the UI dialect of
[Links Notation](https://github.com/link-foundation/links-notation) (LiNo)
and other UI formats: [A2UI](https://a2ui.org),
[Adaptive Cards](https://adaptivecards.io), [JSON Forms](https://jsonforms.io)
and [Lottie](https://lottie.github.io).

Every format has an importer (JSON to LiNo) and an exporter (LiNo to JSON).
Inside the supported subset a round trip is lossless. Outside it, the
converter tells you what it lost:

- Unknown JSON properties are kept as `(extra <format> '<json>')` and
  written back on export.
- Elements outside the subset become `opaque` elements that keep their JSON.
- Every lossy or rejected step adds a diagnostic with a JSON pointer path.

Actions are always data. No converter evaluates expressions, templates or
scripts, and the source never calls `eval` or `new Function`.

## Command line

```bash
npx ui-convert import <file.json> [--format <name>] [--style <style>] > out.lino
npx ui-convert export <file.lino> --format <name> [--id <id>] [--target-version <version>]
```

- `<name>` is one of `a2ui`, `adaptive-cards`, `json-forms` or `lottie`.
  `import` detects the format when `--format` is missing.
- `--style` is `indented` (the default), `multiline` or `inline`.
- `--id` picks the Lottie animation to export.
- `--target-version` is the Adaptive Cards version to export to.
- Diagnostics go to stderr, one per line. The exit code is 1 when one of
  them is an error, and 2 for a usage error.

```bash
npx ui-convert import packages/ui-convert/tests/fixtures/interop/adaptive-cards/hello.json
```

```lino
card: document
  (source adaptive-cards 1.6)
  (extra adaptive-cards '{"$schema":"http://adaptivecards.io/schemas/adaptive-card.json"}')
  stack
    (role body)
    title: text Hello
      (size Large)
      (weight Bolder)
    name: text-field
      (bind name)
      (label Name)
  stack
    (direction horizontal)
    (role actions)
    submit: button
      (on press (submit card))
      (label OK)
```

## API

Every importer returns `{ lino, roots, diagnostics }`, and every exporter
returns `{ json, diagnostics }`. A diagnostic is
`{ code, severity, message, at: { format, path?, element? } }`.

```js
import {
  detectFormat,
  importA2ui,
  exportA2ui,
  a2uiMessagesToDiffs,
  A2uiStream,
  importAdaptiveCard,
  exportAdaptiveCard,
  hostConfigToTheme,
  importJsonForms,
  exportJsonForms,
  importLottie,
  exportLottie,
} from '@link-foundation/ui-convert';

detectFormat(json); // 'a2ui' | 'adaptive-cards' | 'json-forms' | 'lottie' | null

const { lino } = importAdaptiveCard(card);
exportAdaptiveCard(lino, { targetVersion: '1.4' }); // fallbacks + diagnostics
hostConfigToTheme(hostConfig); // a theme document with (token <name> <value>)

const { diffs } = a2uiMessagesToDiffs(messages); // insert, set and remove diffs
const stream = new A2uiStream(); // the same, one message at a time
stream.push(message).diffs;

importJsonForms({ schema, uischema });
exportLottie(lino, 'dot-pulse'); // the animation to export, by id
```

The pinned versions are `A2UI_VERSION` (`0.9.1`), `ADAPTIVE_CARDS_VERSION`
(`1.6`), `JSON_FORMS_VERSION` (`3`) and `LOTTIE_VERSION` (`1.0`).

The element and property names of each format are in
`src/interop/<format>/mapping.lino`.

## Capability matrix

**Supported** means the element converts both ways without loss.
**Partial** means it converts, but part of it is kept as JSON or changed by
normalisation, with a diagnostic. **Unsupported** means it is kept whole as
an `opaque` element, or it is rejected and dropped with an error.

### A2UI 0.9.1 (basic catalog)

| Supported                                                                                                                                                                                                                                                                                                                | Partial                                                                                                                                                                                                                                    | Unsupported                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSurface`, `updateComponents`, `updateDataModel` (JSON pointer paths), `deleteSurface`; `Text`, `Image`, `Icon`, `Row`, `Column`, `List`, `Card`, `Modal`, `Tabs`, `Divider`, `Button`, `TextField`, `CheckBox`, `ChoicePicker`, `Slider`, `DateTimeInput`; data bindings as `(bind <path>)`; child list templates | Several messages for one surface are merged into one full sequence on export (`normalizeA2ui`); child ids that are missing, shared or cyclic keep their raw ids in `extra` (`shared-children`); unknown component keys are kept in `extra` | Components outside the basic catalog (`opaque`); unknown message keys (`unknown-key`, dropped); transport (A2A, SSE, WebSocket); `__proto__`, `constructor` and `prototype` path steps (`unsafe-path`, rejected) |

### Adaptive Cards 1.6

| Supported                                                                                                                                                                                                                                                                                                       | Partial                                                                                                                                                                                                                                                                    | Unsupported                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TextBlock`, `Image`, `Container`, `ColumnSet`, `Column`, `FactSet`, `ActionSet`, `Input.Text`, `Input.Number`, `Input.Date`, `Input.Time`, `Input.Toggle`, `Input.ChoiceSet`, `Action.Submit`, `Action.OpenUrl`, `Action.ShowCard`, `Action.ToggleVisibility`, `Action.Execute`; `fallback` and `fallbackText` | Export to an older `targetVersion`: a newer element is replaced by its `fallback` (`version-fallback`) or dropped (`version-drop`), and newer properties are dropped (`version-drop-property`); templating strings (`${...}`) are kept as literal text and never evaluated | `Table`, `Media`, `RichTextBlock`, `ImageSet` and other elements (`opaque`, round-trip unchanged); `javascript:`, `data:` and `vbscript:` URLs in `Action.OpenUrl` (`unsafe-url`, dropped) |

`hostConfigToTheme` maps container and foreground colours (as
`#RRGGBBAA`), spacing, font families, font sizes and font weights to theme
tokens. Host config paths it does not map are listed in the
`unmapped-host-config` diagnostic and by `hostConfigToThemeDetails`.

### JSON Forms 3

| Supported                                                                                                                                                                                                                                                                                                                                                            | Partial                                                                                                                                                                       | Unsupported                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `VerticalLayout`, `HorizontalLayout`, `Group`, `Categorization`, `Category`, `Label`, `Control` (`scope` as `(bind <path>)`); schema `type`, `title`, `description`, `default`, `required`, `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `format`, `enum`, `oneOf`; rules with `HIDE`, `SHOW`, `ENABLE` or `DISABLE` and a `const` or `enum` condition | Other rule conditions are kept as `(rule (json '<json>'))` and never evaluated (`unsupported-rule`); schema properties without a `Control` stay in `extra` (`unbound-schema`) | Other UI schema elements, such as `ListWithDetail` and custom renderers (`opaque`) |

### Lottie 1.0

| Supported                                                                                                                                                                                                                                                      | Partial                                                                                                                                                                                                                        | Unsupported                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shape layers with rectangle, ellipse, path, fill, stroke, group and transform items; layer anchor, position, scale, rotation, opacity and skew, static or animated; frames as milliseconds; bezier easing as `(cubic-bezier ...)` and hold keys; SVG path data | Other shape items (gradients, trim paths, repeaters and so on) are kept as JSON (`unsupported-shape`); null, solid and precomposition layers are kept as `opaque` elements; one level of precomposition assets is kept as JSON | Text, image and audio layers, effects, expressions, image and data assets, and precompositions inside precompositions: rejected and dropped with an error; expressions are never evaluated |

## Tests

```bash
node --test packages/ui-convert/tests/interop-*.test.js
npx playwright test tests/e2e/interop-lottie.spec.js
```

- `tests/interop-{a2ui,adaptive-cards,json-forms,lottie}.test.js`:
  `export(import(x))` deep-equals the normalised fixture, the LiNo is
  stable through `links-notation`, `extra` survives, and each format's
  special cases (A2UI incremental diffs, Adaptive Cards versions and host
  configs, JSON Forms bindings and rules, Lottie schema validation and
  rejected input).
- `tests/interop-detect.test.js` and `tests/interop-cli.test.js`: format
  detection and the command line.
- `tests/e2e/interop-lottie.spec.js` (repository root): an exported Lottie
  plays in lottie-web on a page whose Content-Security-Policy forbids eval.
- The fixtures, their sources and their licences are listed in
  `tests/fixtures/interop/SOURCES.md`.

## Licence

[Unlicense](LICENSE). The test fixtures copied from other projects keep
their licences (see `tests/fixtures/interop/REUSE.toml`).
