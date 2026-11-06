# @link-foundation/ui-convert

Converters between other UI formats and the `ui-dialect/0` dialect of
[Links Notation](https://github.com/link-foundation/links-notation) (LiNo),
part of the associative UI framework
[`link-foundation/ui`](https://github.com/link-foundation/ui):

- the **HTML/DOM importer** (HTML text or a live DOM to LiNo),
- the **component importers** for React / MUI JSX and TSX and Vue
  single-file components, mapped by LiNo match / replace rules, and
- **interop** with [A2UI](https://a2ui.org),
  [Adaptive Cards](https://adaptivecards.io),
  [JSON Forms](https://jsonforms.io) and [Lottie](https://lottie.github.io):
  an importer (JSON to LiNo) and an exporter (LiNo to JSON) per format.

All converters report the same diagnostic type as `@link-foundation/ui-core`:
`{ code, severity, message, at }`.

```sh
npm install @link-foundation/ui-convert
```

For browser bundles, import `importDom`, `importHtml`, `mapHtmlElement` and
`htmlVocabulary` from `@link-foundation/ui-convert/browser`. This typed entry
avoids the Node exporters, component compiler dependencies and mapping assets
of the full root entry. The root entry and CLI keep their existing APIs.

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
ok: button
  label OK
  attr class primary
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

| Field         | Content                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `text`        | Links Notation text (`style: 'indented'`, the nested form, by default, or `multiline`/`inline`) |
| `tree`        | The element tree of `text`, as `parse` of `@link-foundation/ui-core` gives it                   |
| `links`       | The `Link` objects of `links-notation` the text was formatted from                              |
| `spans`       | `Map` link id -> `{ start, end }`: `html.slice(start, end)` is the element                      |
| `diagnostics` | Dropped unsafe content (`dropped-script`) and projection diagnostics                            |
| `nodeMap`     | `importDom` only: `Map` link id -> original DOM `Node`                                          |

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

## Component import: JSX / TSX (MUI) and Vue

`importJsx(text, options)` and `importVue(text, options)` read React / MUI
JSX or TSX and Vue single-file components into the dialect. They never run
the code. They return `{ text, tree, links, spans, applied, diagnostics }`:

- `spans`: link id to `{ start, end }` in the source;
- `applied`: link id to the mapping rule that produced the link;
- `diagnostics`: `{ code, severity, message, span, id }`.

```js
import { importJsx, importVue } from '@link-foundation/ui-convert';

importJsx(`
<Stack direction="column" spacing={2}>
  <TextField label="Email" />
  <Button variant="contained" onClick={signIn}>
    Sign in
  </Button>
</Stack>`).text;
```

```lino
stack-0: stack
  direction vertical
  gap
    token space.2
  text-field-0-0: text-field
    label Email
  button-0-1: button
    label 'Sign in'
    variant filled
    on press
      action signIn
```

```sh
ui-convert import login.jsx                       # .jsx, .tsx, .vue: --from is implied
ui-convert import --from jsx Login.js --mapping mui
ui-convert import --from vue Todo.vue --mapping my-rules.lino --mapping mui
```

### Mapping rules

Components are mapped by LiNo match / replace rules in the shape of
[transformer](https://github.com/link-foundation/transformer)
(`src/rules.js`). The built-in MUI rules are in `src/mappings/mui.lino`:

```lino
mui-button-contained: rule
  match
    Button
      variant contained
      children $label
      optional
        disabled $disabled
  replace
    button
      label $label
      variant filled
      disabled $disabled
```

- `$name` binds a value. It can also sit inside an atom: `space.$n`.
- `_` matches anything.
- `(optional (p $v))` matches when the property is there and is skipped
  otherwise.
- `(absent p)` matches only when the element has no property `p`.
- An unbound variable drops its property from the replacement.
- Rules are tried in order and the first match wins.
- Properties a rule does not consume stay as `(attr name value)`.

`options.mappings` is a list of built-in names (`'mui'`, the default) and
rule texts. Each mapping is tried in that order.

| MUI                                             | Dialect                                                         |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `Button` `variant` contained / outlined / text  | `button` `(variant filled / outlined / text)`, `(label …)`      |
| `IconButton` `aria-label`                       | `icon-button (label …)`                                         |
| `TextField` (`multiline`)                       | `text-field` (`text-area`)                                      |
| `Checkbox`, `Switch`                            | `checkbox`, `switch`                                            |
| `Typography` `variant` h1–h6 / body1 / body2    | `text (level 1–6)` / `(variant body-large / body-medium)`       |
| `Stack` `direction` column / row, `spacing={n}` | `stack (direction vertical / horizontal) (gap (token space.n))` |
| `Box`, `Card`, `CardContent`, `Dialog`          | `box`, `card`, `card-content`, `dialog`                         |
| `Tabs` / `Tab`, `List` / `ListItem`             | `tabs` / `tab`, `list` / `list-item`                            |
| `AppBar`, `Toolbar`                             | `app-bar`, `toolbar`                                            |
| any other component                             | `(html (tag Name) …)` and an `unmapped-component` info note     |

Lowercase elements (`div`, `button`) use the HTML importer's mapping table.

### JSX

- Supported: elements, fragments (flattened), text children, and string,
  number and boolean props.
- `className` and `htmlFor` become `class` and `for`.
- `style` and `sx` objects with literal values become `(style ...)`.
  Numbers in `style` get `px`, as in React. `sx` keys are kept as written
  (`p`).
- `onClick={save}` becomes `(on press (action save))`. Other handlers
  become `(on <event> ...)` with the event in kebab-case.
- Everything else needs the code to run. Examples: a spread
  `{...props}`, an inline arrow `onClick={() => save(x)}`, a variable
  value, `{items.map(...)}`, a theme callback in `sx`. Each is kept as
  `(unsupported jsx-expression '<source>')` with one diagnostic and span.
- In `.tsx`, type assertions around a value (`x as T`, `x!`,
  `x satisfies T`) are read as the value.
- In a whole module, every outermost JSX element is a top-level link.

### Vue

| Template                          | Link                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| `label="Email"`                   | a prop, matched by the mapping rules                            |
| `:spacing="2"`                    | a prop (the value is a literal)                                 |
| `:checked="item.done"`            | `(bind checked (param item.done))`                              |
| `v-model="draft.text"`            | `(bind value (param draft.text))`                               |
| `:style="{ color: 'red' }"`       | `(style (color red))`                                           |
| `@click="addItem"`                | `(on press (action addItem))`                                   |
| `v-if="todo.items"` / `v-else`    | `(when (param todo.items))` / `(when (not (param todo.items)))` |
| `v-for="(item, i) in todo.items"` | `(each item (param todo.items) (index i))`                      |

The following are each kept as `(unsupported vue-directive '<source>')`
with a diagnostic:

- other directives (`v-else-if`, `v-show`, `v-slot`, custom directives);
- modifiers (`@click.prevent`, `v-model.trim`);
- dynamic arguments;
- expressions that are not paths or handler names.

An interpolation `{{ name }}` is kept as `(unsupported vue-expression ...)`.
Comments are dropped. `<script>`, `<style>` and custom blocks become raw
`vue-block` links with `(tag ...)`, `(attr ...)` and `(content ...)`
(one atom per line), each with an `info` diagnostic.

`when` and `each` follow the reserved links of
[`docs/spec/behaviour.md`](../../docs/spec/behaviour.md). Their evaluation
is not part of `ui-dialect/0` yet (#33).

### Differences from the issue's sketch

- **Direction values.** Stack directions use the spec values `vertical` /
  `horizontal`.
- **Gap token.** The gap token is the single atom `space.2` of
  `@link-foundation/ui-tokens`.
- **Ids.** Ids follow the HTML importer: path ids such as `button-0-1`.
- **Diagnostics.** They also carry `severity` and the `id` of their link.

### Status: meta-language

The issue asked to parse JSX and Vue with
[`meta-language`](https://github.com/link-foundation/meta-language). Its npm
release **0.46.0 has no JSX/TSX and no Vue SFC support**:

- its JavaScript/TypeScript profile only tokenizes;
- its embedded regions know only Markdown and HTML;
- it has no HTML element tree.

The request is
[link-foundation/meta-language#231](https://github.com/link-foundation/meta-language/issues/231)
(and #230 for HTML). Until it lands, JSX/TSX is read with
[`@babel/parser`](https://babeljs.io/docs/babel-parser) and Vue with
[`@vue/compiler-dom`](https://github.com/vuejs/core). Both are MIT and both
only parse. A meta-language reader only needs to produce the same
intermediate form (`src/jsx/parse.js`, `src/vue/parse.js`).

### Tests

```bash
node --test packages/ui-convert/tests/{jsx-import,vue-import,rules,mui-mapping}.test.js
```

- `jsx-import`, `vue-import`: each fixture in
  `tests/{jsx,vue}/fixtures` gives its `.lino`, which parses with
  `links-notation` and the ui-core parser, and every span slices to its
  source. The unsupported fixtures give one diagnostic with a span per
  construct.
- `rules`: `$var` binding, templates, `optional`, `absent`, a non-matching
  rule and first match wins.
- `mui-mapping`: one case per MUI component and variant, plus a check that
  every rule of `mui.lino` is used by a case.

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
  source adaptive-cards 1.6
  extra adaptive-cards '{"$schema":"http://adaptivecards.io/schemas/adaptive-card.json"}'
  stack
    role body
    title: text Hello
      size Large
      weight Bolder
    name: text-field
      bind name
      label Name
  stack
    direction horizontal
    role actions
    submit: button
      on press
        submit card
      label OK
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
and `links-notation` (Unlicense), `parse5` and `prettier` (MIT). The export
build tests also use Vite and its Vue plugin (MIT), React (MIT) and Vue (MIT).
Only the tests use `jsdom`
(MIT), `ajv` (MIT), `lottie-web` (MIT) and
`@lottie-animation-community/lottie-specs` (MIT). The test fixtures copied
from other projects keep their licences (see
`tests/fixtures/interop/REUSE.toml`).

## Export to source

`exportDocument` is a one-way convenience for committing and editing source.
LiNo remains the source of truth; the runtime adapters remain the normal rendering
path. The asynchronous API uses Prettier 3 for JSX, Vue and CSS formatting:

```js
import { exportDocument } from '@link-foundation/ui-convert';

const { files, diagnostics } = await exportDocument(source, {
  target: 'react', // react | vue | swiftui | compose
  mode: 'wrapper', // wrapper (default) | eject; native targets always emit native source
  componentName: 'App',
});
// files: [{ path: 'App.jsx', contents: '...' }]
```

`source` accepts LiNo text or a ui-core document tree. Export does not mutate the
tree. Component names must start with an uppercase letter and contain only ASCII
letters, digits and underscores; names that collide with generated view imports
are rejected. All files and diagnostics have deterministic order.

- **React/Vue wrapper:** imports the public `UiView` adapter, embeds the original
  LiNo (escaping backslashes, backticks, interpolation and script terminators),
  and supplies one empty handler per distinct action head. Pass an `actions`
  object to override the stubs. Handlers receive the adapter's normal action
  detail and event. Unknown extensions are retained and reported in comments.
- **React/Vue eject:** emits semantic HTML using the reverse HTML import table,
  stable IDs, generated classes and a separate CSS file. Stacks use flex layouts;
  token references become CSS custom properties such as `var(--space-medium)`.
  Theme token declarations become custom properties. Buttons map their variants
  to CSS. Actions call the supplied handler with the literal LiNo arguments.
  Unsupported events, styles, kinds and properties yield comments and warnings.
  Supply the relevant token CSS when tokens are defined outside the document.
- **SwiftUI/Compose:** emits source using the kind tables in
  `src/export/targets/*.lino`, with four spaces per indentation level. Stacks,
  text, buttons, text fields and toggles are supported; fields use local editable
  state. Button actions call an optional dictionary/map of handlers accepting
  string argument arrays/lists. SwiftUI filled buttons use
  `.buttonStyle(.borderedProminent)`. Other unsupported native features are
  reported rather than inferred. Token references use `Tokens.spaceMedium`
  (Swift) / `Tokens.SpaceMedium` (Kotlin), matching ui-tokens; include its generated
  token file in your native project. There is no native runtime dependency.

Every unsupported construct produces both an output comment and a diagnostic
`{ code: 'unsupported', severity: 'warning', id, target, message }`. Parse
errors also remain in `diagnostics`. Exporters do not execute document code.
The supported subset is intentionally smaller than the runtime renderer;
round-trip code editing and other platform exporters are outside this API.

```bash
npx ui-convert export --target react --mode eject --out generated app.lino
npx ui-convert export --target vue --component-name Login app.lino
npx ui-convert export --target swiftui docs/case-studies/issue-1/samples/document.lino
npx ui-convert export --target compose --out generated app.lino
```

Without `--out`, stdout contains the source files in returned order (component,
then CSS for web eject); diagnostics go to stderr. With `--out`, all files are
written into that directory. A file named `-` reads stdin. Existing JSON interop
exports continue to use `--format` and cannot be combined with `--target`.

Verification: `node --test packages/ui-convert/tests/export/*.test.js` checks the
`document`, `form` and `unsupported` goldens for all targets/modes, determinism,
wrapper escaping, Vite builds, live jsdom equality with the original `UiView`,
handler overrides, CLI behavior and the React form's exact import round trip.
Native compilation is optional: Swift checks require `swiftc` and an Apple SDK;
Kotlin checks require `kotlinc` and `UI_CONVERT_COMPOSE_CLASSPATH` with the actual
Compose libraries. Missing SDKs produce explicit skips; no native APIs are mocked.

The basic native APIs were checked against the official
[SwiftUI state/binding documentation](https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app)
and [Compose text field documentation](https://developer.android.com/develop/ui/compose/text/user-input).
A runnable generated-code preview is in [examples/code-export](../../examples/code-export/).
