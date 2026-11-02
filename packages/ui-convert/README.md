# @link-foundation/ui-convert

Converters between other UI formats and the `ui-dialect/0` dialect of
[Links Notation](https://github.com/link-foundation/links-notation), part of
the associative UI framework
[`link-foundation/ui`](https://github.com/link-foundation/ui).

This release has the **HTML/DOM importer**.

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

## License

[Unlicense](LICENSE) (public domain). Dependencies: `links-notation`
(Unlicense), `parse5` (MIT); `jsdom` (MIT) is used only by the tests.
