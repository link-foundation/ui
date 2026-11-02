# @link-foundation/ui-convert

Converters between other UI formats and the `ui-dialect/0` dialect of
[Links Notation](https://github.com/link-foundation/links-notation) (LiNo),
part of the associative UI framework
[`link-foundation/ui`](https://github.com/link-foundation/ui):

- the **HTML/DOM importer** (HTML text or a live DOM to LiNo), and
- **interop** with [A2UI](https://a2ui.org),
  [Adaptive Cards](https://adaptivecards.io),
  [JSON Forms](https://jsonforms.io) and [Lottie](https://lottie.github.io):
  an importer (JSON to LiNo) and an exporter (LiNo to JSON) per format.

All converters report the same diagnostic type as `@link-foundation/ui-core`:
`{ code, severity, message, at }`.

```sh
npm install @link-foundation/ui-convert
```

## HTML import

`importHtml(text, options)` turns an HTML string into a dialect document. It
works in Node.js, Bun, Deno and browsers.

```js
import { importHtml } from '@link-foundation/ui-convert';

const { text, tree, spans, diagnostics } = importHtml(
  '<button id="ok" class="primary">OK</button>'
);
console.log(text);
```

```lino
(ok: button
  (label OK)
  (attr class primary))
```

`importDom(root, options)` does the same for a live DOM subtree (a browser
`Element`, `Document` or `DocumentFragment`, or one from jsdom) and also
returns `nodeMap`, the original DOM node of every link id, for dev tools:

```js
import { importDom } from '@link-foundation/ui-convert';

const { text, nodeMap } = importDom(document.querySelector('#app'));
nodeMap.get('ok'); // the <button id="ok"> element itself
```

Both give the same text for the same markup. The result is:

| Field         | Content                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `text`        | Links Notation text (`style: 'multiline'` by default, or `inline`/`indented`) |
| `tree`        | The element tree of `text`, as `parse` of `@link-foundation/ui-core` gives it |
| `links`       | The `Link` objects of `links-notation` the text was formatted from            |
| `spans`       | `Map` link id -> `{ start, end }`: `html.slice(start, end)` is the element    |
| `diagnostics` | Dropped unsafe content (`dropped-script`) and projection diagnostics          |
| `nodeMap`     | `importDom` only: `Map` link id -> original DOM `Node`                        |

Options: `vocabulary` (default `htmlVocabulary()`), `mapping` (default
`HTML_MAPPING`), `comments` (keep HTML comments as `comment` elements),
`style` and `indent` (output form), `document` (`importHtml`: parse a whole
document instead of a fragment) and `location` (`importDom`: a function giving
the source `{ start, end }` of a DOM node, for spans).

### How it works

1. **Read.** HTML text is read by [parse5](https://github.com/inikulin/parse5)
   (the spec-compliant parser jsdom uses) with source locations; a DOM is
   walked through the standard `Node` API. Both readers produce one shared
   intermediate form `{ tag, attrs, children, text, span }`. There is no
   regular-expression HTML or Links Notation parsing; ESLint forbids regular
   expressions in `src/html/`.
2. **Ids.** Every node gets a deterministic, unique id: its `id` attribute
   when that is a valid unique reference, otherwise its path (`div-0-2-1`:
   tag and sibling indices). A duplicate gets the first free suffix (`card`,
   `card-2`, `card-3`) and keeps `(attr id card)`, so nothing is lost.
3. **Map.** `HTML_MAPPING` is a data table from semantic HTML to dialect
   kinds:

   | HTML                                        | Kind                             |
   | ------------------------------------------- | -------------------------------- |
   | `button`, `input[type=button/submit/reset]` | `button` (`label` from the text) |
   | `a[href]`                                   | `link` (`label`, `href`)         |
   | `p`, `span`, `label`, `h1`–`h6`             | `text` (`level` for headings)    |
   | `img`                                       | `image` (`source`, `alt`)        |
   | `input[type=checkbox]`                      | `checkbox`                       |
   | `input[type=text]`, `textarea`              | `text-field`, `text-area`        |
   | `ul`, `ol`                                  | `list`                           |

   A rule is used only when the vocabulary has its kind. `link`, `checkbox`,
   `text-field`, `text-area` and `list` are not in the `ui-dialect/0`
   vocabulary yet, so they use the fallback until it has them (or pass
   `extendVocabulary(htmlVocabulary(), '(link: kind ...)')`). Everything else
   uses the lossless fallback `(id: html (tag div) (attr class card) ...)`.
   Attributes that a kind does not consume stay as `(attr name value)`, and a
   tag other than the one the kind stands for stays as `(tag span)`.

4. **Style.** An inline `style` becomes
   `(style (padding 8px) (color '#3390ec'))`; a `<style>` element becomes
   `(raw-css '...')` on its parent. Values are quoted by `links-notation`
   (`escapeReference`) whenever they need it: hex colours, URLs, values with
   `:` or spaces.
5. **Format.** The importer builds `Link` objects and formats them with
   `format` of `@link-foundation/ui-core` (which writes every link with
   `Link.format`). It never concatenates Links Notation text.

### Security

`script`, `iframe`, `object` and `embed` elements, every `on*` attribute and
every attribute whose value is a `javascript:` or `vbscript:` URL are dropped.
Each dropped item gives one diagnostic:

```js
{ code: 'dropped-script', severity: 'warning', id: 'button-0-1',
  message: 'Dropped the event handler attribute "onclick" of "button-0-1"' }
```

### Reading the result back

The `html` fallback kind and the `tag`, `attr`, `style` and `raw-css`
properties are declared in `HTML_VOCABULARY_TEXT`. Parse an import result with
that vocabulary to get it back without diagnostics:

```js
import { parse, format } from '@link-foundation/ui-core';
import { htmlVocabulary, importHtml } from '@link-foundation/ui-convert';

const { text } = importHtml(html);
const doc = parse(text, { vocabulary: htmlVocabulary() });
doc.diagnostics; // []
format(doc) === text; // true
```

### Status: meta-language

The plan for this importer was to read HTML with the native HTML import of
[`meta-language`](https://github.com/link-foundation/meta-language). Its npm
release 0.46.0 has no HTML element tree with source spans, so that step is
blocked on
[link-foundation/meta-language#230](https://github.com/link-foundation/meta-language/issues/230).
Until then HTML text is read with parse5; a meta-language reader only needs to
produce the same intermediate form (`src/html/tree.js`).

## Interop: A2UI, Adaptive Cards, JSON Forms and Lottie

Every format has an importer (JSON to LiNo) and an exporter (LiNo to JSON).
Inside the supported subset a round trip is lossless. Outside it, the
converter tells you what it lost:

- Unknown JSON properties are kept as `(extra <format> '<json>')` and
  written back on export.
- Elements outside the subset become `opaque` elements that keep their JSON.
- Every lossy or rejected step adds a diagnostic with a JSON pointer path.

Actions are always data. No converter evaluates expressions, templates or
scripts, and the source never calls `eval` or `new Function`.

### Command line

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

### API

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

### Capability matrix

**Supported** means the element converts both ways without loss.
**Partial** means it converts, but part of it is kept as JSON or changed by
normalisation, with a diagnostic. **Unsupported** means it is kept whole as
an `opaque` element, or it is rejected and dropped with an error.

#### A2UI 0.9.1 (basic catalog)

| Supported                                                                                                                                                                                                                                                                                                                | Partial                                                                                                                                                                                                                                    | Unsupported                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSurface`, `updateComponents`, `updateDataModel` (JSON pointer paths), `deleteSurface`; `Text`, `Image`, `Icon`, `Row`, `Column`, `List`, `Card`, `Modal`, `Tabs`, `Divider`, `Button`, `TextField`, `CheckBox`, `ChoicePicker`, `Slider`, `DateTimeInput`; data bindings as `(bind <path>)`; child list templates | Several messages for one surface are merged into one full sequence on export (`normalizeA2ui`); child ids that are missing, shared or cyclic keep their raw ids in `extra` (`shared-children`); unknown component keys are kept in `extra` | Components outside the basic catalog (`opaque`); unknown message keys (`unknown-key`, dropped); transport (A2A, SSE, WebSocket); `__proto__`, `constructor` and `prototype` path steps (`unsafe-path`, rejected) |

#### Adaptive Cards 1.6

| Supported                                                                                                                                                                                                                                                                                                       | Partial                                                                                                                                                                                                                                                                    | Unsupported                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TextBlock`, `Image`, `Container`, `ColumnSet`, `Column`, `FactSet`, `ActionSet`, `Input.Text`, `Input.Number`, `Input.Date`, `Input.Time`, `Input.Toggle`, `Input.ChoiceSet`, `Action.Submit`, `Action.OpenUrl`, `Action.ShowCard`, `Action.ToggleVisibility`, `Action.Execute`; `fallback` and `fallbackText` | Export to an older `targetVersion`: a newer element is replaced by its `fallback` (`version-fallback`) or dropped (`version-drop`), and newer properties are dropped (`version-drop-property`); templating strings (`${...}`) are kept as literal text and never evaluated | `Table`, `Media`, `RichTextBlock`, `ImageSet` and other elements (`opaque`, round-trip unchanged); `javascript:`, `data:` and `vbscript:` URLs in `Action.OpenUrl` (`unsafe-url`, dropped) |

`hostConfigToTheme` maps container and foreground colours (as
`#RRGGBBAA`), spacing, font families, font sizes and font weights to theme
tokens. Host config paths it does not map are listed in the
`unmapped-host-config` diagnostic and by `hostConfigToThemeDetails`.

#### JSON Forms 3

| Supported                                                                                                                                                                                                                                                                                                                                                            | Partial                                                                                                                                                                       | Unsupported                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VerticalLayout`, `HorizontalLayout`, `Group`, `Categorization`, `Category`, `Label`, `Control` (`scope` as `(bind <path>)`); schema `type`, `title`, `description`, `default`, `required`, `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `format`, `enum`, `oneOf`; rules with `HIDE`, `SHOW`, `ENABLE` or `DISABLE` and a `const` or `enum` condition | Other rule conditions are kept as `(rule (json '<json>'))` and never evaluated (`unsupported-rule`); schema properties without a `Control` stay in `extra` (`unbound-schema`) | Other UI schema elements, such as `ListWithDetail` and custom renderers (`opaque`); scopes that name `__proto__`, `constructor` or `prototype` are kept raw and their schema is not read (`unsafe-path`) |

#### Lottie 1.0

| Supported                                                                                                                                                                                                                                                      | Partial                                                                                                                                                                                                                        | Unsupported                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shape layers with rectangle, ellipse, path, fill, stroke, group and transform items; layer anchor, position, scale, rotation, opacity and skew, static or animated; frames as milliseconds; bezier easing as `(cubic-bezier ...)` and hold keys; SVG path data | Other shape items (gradients, trim paths, repeaters and so on) are kept as JSON (`unsupported-shape`); null, solid and precomposition layers are kept as `opaque` elements; one level of precomposition assets is kept as JSON | Text, image and audio layers, effects, expressions, image and data assets, and precompositions inside precompositions: rejected and dropped with an error; expressions are never evaluated |

### Tests

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

## License

[Unlicense](LICENSE) (public domain). Dependencies: `@link-foundation/ui-core`
and `links-notation` (Unlicense), `parse5` (MIT). Only the tests use `jsdom`
(MIT), `ajv` (MIT), `lottie-web` (MIT) and
`@lottie-animation-community/lottie-specs` (MIT). The test fixtures copied
from other projects keep their licences (see
`tests/fixtures/interop/REUSE.toml`).
