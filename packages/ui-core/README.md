# @link-foundation/ui-core

Core of the associative UI framework [`link-foundation/ui`](https://github.com/link-foundation/ui).

This package reads a UI written in the `ui-dialect/0` dialect of
[Links Notation](https://github.com/link-foundation/links-notation) and gives
an element tree, following the specification in
[`docs/spec/`](https://github.com/link-foundation/ui/blob/main/docs/spec/README.md).
It does not use regular expressions; the parsing is done by `links-notation`.

```sh
npm install @link-foundation/ui-core
```

## Three forms, one tree

The same button can be written on one line, over several lines inside
parentheses, or indented without parentheses:

```lino
(ok: button (label 'OK') (variant filled) (on press (navigate home)))
```

```lino
(ok: button
  (label 'OK')
  (variant filled)
  (on press
    (navigate home)))
```

```lino
ok: button
  label 'OK'
  variant filled
  on press
    navigate home
```

All three give the same tree:

```js
import { parse } from '@link-foundation/ui-core';

const doc = parse(text);
console.log(JSON.stringify(doc.roots[0], null, 2));
console.log(doc.diagnostics); // []
```

```json
{
  "id": "ok",
  "kind": "button",
  "positional": [],
  "properties": [
    { "name": "label", "values": ["OK"] },
    { "name": "variant", "values": ["filled"] },
    { "name": "on", "values": ["press", ["navigate", "home"]] }
  ],
  "children": [],
  "unknown": []
}
```

The rules for turning links into elements, properties, children and values
are in [`elements.md`](https://github.com/link-foundation/ui/blob/main/docs/spec/elements.md)
and [`projection.md`](https://github.com/link-foundation/ui/blob/main/docs/spec/projection.md).

## Diagnostics

`parse` does not throw on bad input. It returns every problem in
`doc.diagnostics` as `{ code, severity, message, at }`, using the codes listed
in [`limits.md`](https://github.com/link-foundation/ui/blob/main/docs/spec/limits.md):

```js
parse('(a: button (glow 2))\n(a: text Hi)').diagnostics;
// [
//   { code: 'unknown-sublink', severity: 'warning', at: { element: 'a', head: 'glow' }, message: … },
//   { code: 'duplicate-id', severity: 'error', at: { element: 'a' }, message: … }
// ]

parse('(a: button').diagnostics;
// [{ code: 'syntax-error', severity: 'error', at: { line: 1, column: 11 }, message: … }]
```

`parseOrThrow` returns the document when there are no errors, and throws a
`UiParseError` (with `diagnostics` and `document`) when there are. Warnings
alone do not make it throw.

## Editing the source text

`format` writes a document from its tree, so `#` comments and layout are not
kept. To change a document a person wrote, edit its text in place with
`@link-foundation/ui-core/source`. Each edit changes only the bytes it must,
and is checked: the new text must parse to the tree the same change gives on
`parse(text)`, otherwise nothing is changed and `{ ok: false, error }` is
returned.

```js
import { setProp, applyOpsToSource } from '@link-foundation/ui-core/source';

const text = `# primary action
(ok: button
  (label 'OK')   # shown on the button
  (variant filled))
`;

setProp(text, 'ok', 'label', ['Cancel']);
// { ok: true,
//   text: "# primary action\n(ok: button\n  (label 'Cancel')   # shown on the button\n  (variant filled))\n",
//   edits: [{ start: 38, end: 42, insert: "'Cancel'" }] }

applyOpsToSource(text, [
  { op: 'setProp', id: 'ok', name: 'note', values: ['Why this is red'] },
  { op: 'rename', id: 'ok', to: 'confirm' },
]).text;
// # primary action
// (confirm: button
//   (label 'OK')   # shown on the button
//   (variant filled)
//   (note 'Why this is red'))
```

| Export                                              | Purpose                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `indexSource(text)`                                 | `{ root, form, document, unit }`: the span tree (`{ start, end, kind, children, … }` for every element, property and value) and the form.  |
| `setProp(text, id, name, values)`                   | Replace the values of a property (the last one, if it is repeated), or append it.                                                          |
| `removeProp(text, id, name)`                        | Remove a property.                                                                                                                         |
| `setPositional(text, id, values)`                   | Replace the positional values of an element.                                                                                               |
| `insertChild(text, parentId, index, lino)`          | Insert a child element (`parentId` `null`: a root) at `index` among the child elements.                                                    |
| `removeNode(text, id)`                              | Remove an element, the line it leaves empty and the comment lines directly above it.                                                       |
| `moveNode(text, id, parentId, index)`               | Move an element, with the comment lines directly above it.                                                                                 |
| `renameId(text, from, to)`                          | Rename the definition only; `references` lists the other references to the old id for the caller.                                          |
| `applyOpsToSource(text, ops)`                       | Apply the ops `insert`, `remove`, `move`, `setProp`, `removeProp`, `rename`, `setPositional` in order, checked after each, all or nothing. |
| `applyOpToTree(doc, op)`, `checkEdit`, `applyEdits` | The tree reference the edits are checked against, the check itself, and applying `{ start, end, insert }` edits.                           |
| `scanDelimiters`, `quotedEnd`, `SourceIndexError`   | The delimiter scanner (no regular expressions) and the error thrown when a span does not match the parser.                                 |

Each edit returns `{ ok: true, text, edits }` (`edits` are `{ start, end,
insert }` in offsets of the old text) or `{ ok: false, error }`. The edits
keep the layout of the document: a new node takes the indentation of its
nearest sibling, a one-line document gets the node inline after one space,
new values are quoted with `escapeReference` when they need it, and line
breaks stay CRLF in a CRLF text.

**Stopgap.** `links-notation` does not report where a link was read from, so
`scan.js` finds the delimiters itself and `index.js` checks every span by
parsing it again with the official parser; any mismatch throws a
`SourceIndexError` with the path of the link. When `links-notation` reports
source positions, `index.js` takes the spans from the parser and `scan.js` is
deleted.

### Notes that survive

A `#` comment carries no meaning, so a tool that writes the document from its
tree drops it. Write what must survive as a `note`, a property of every kind:

```lino
(ok: button
  (label OK)
  (note 'Why this is red'))
```

`parse` keeps it in `properties` and `format` writes it back in all three
forms. The links store of
[link-foundation/ui#16](https://github.com/link-foundation/ui/issues/16)
(`@link-foundation/ui-store`) keeps it too: text → store → text, its
operation log written as Links Notation and replayed, and undo/redo
(`packages/ui-store/tests/note.test.js`).

## Typed values

`parse` keeps values as the raw strings and arrays of the tree. The `values`
namespace types them with the property types of the vocabulary
([`values.md`](https://github.com/link-foundation/ui/blob/main/docs/spec/values.md)):

```js
import { parse, values } from '@link-foundation/ui-core';

values.typeValue('16px', { type: 'dimension' }).value;
// { type: 'dimension', value: 16, unit: 'px' }
values.typeValue(['token', 'color.primary'], { type: 'color' }).value;
// { type: 'token-ref', path: 'color.primary' }
values.toCss({ type: 'token-ref', path: 'color.primary' }); // 'var(--color-primary)'

const { roots, diagnostics } = values.typeDocument(
  parse('(box: stack (gap abc))')
);
roots[0].properties[0].typed; // [null]
diagnostics;
// [{ code: 'invalid-value', severity: 'error', at: { element: 'box', property: 'gap' },
//    expected: 'dimension', message: … }]
```

Typing is driven by the declared type: `links-notation` does not tell whether
an atom was quoted, so `'16px'` and `16px` are the same value. Where no type is
declared (`any`), `inferValue` guesses: number, dimension, duration, hex
colour, then string.

| Type          | Text                                             | Typed value                                                                            |
| ------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `dimension`   | `16px`, `1.5rem`, `-1em`, `50%`, `100vw`, `0`    | `{ type, value, unit }` (`unit` is `''` for `0`)                                       |
| `duration`    | `150ms`, `0.2s`                                  | `{ type, value, unit }`                                                                |
| `number`      | `-1`, `0.5`, `1.5e3`                             | `{ type, value }`                                                                      |
| `color`       | `'#6750A4'`, `(rgb 103 80 164)`, `(oklch l c h)` | `{ type, space: 'srgb', r, g, b, a }` (0..1) or `{ type, space: 'oklch', l, c, h, a }` |
| `string`      | `Hello`, `'Links UI demo'`                       | `{ type, value }`                                                                      |
| `(enum a b)`  | `a`                                              | `{ type: 'enum', value }`                                                              |
| `url`         | `'https://example.com/a.svg'`, `hero.png`        | `{ type, value }`                                                                      |
| `element-ref` | `hello`                                          | `{ type, id }`                                                                         |
| `action`      | `(navigate hello)`                               | `{ type, name, args }`                                                                 |
| `boolean`     | `true`, `false`                                  | `{ type, value }` (no spec property uses it yet)                                       |
| any type      | `(token a.b)`, `(param a.b)`, `(or x y z)`       | `token-ref`, `param`, `fallback` (options typed)                                       |

| Export                                                  | Purpose                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `typeValue(raw, spec?, { at, vocabulary })`             | `{ value, diagnostics }`; `value` is `null` for an invalid value. Never throws.                    |
| `typeNode(node)`, `typeDocument(doc)`                   | Adds `typed` to each property and `typedPositional` to each element.                               |
| `inferValue(raw)`                                       | The type of a value without a declared type.                                                       |
| `formatValue(v)`, `parseValue(text)`                    | Canonical Links Notation and back: `typeValue(parseValue(formatValue(v)), spec).value` equals `v`. |
| `toCss(v, { refToVar }?)`                               | CSS text; references become `var(--color-primary)`, `(or …)` nested `var()` fallbacks.             |
| `parseColor`, `toHex`, `oklchToSrgb`, `srgbToOklch`     | Colours; `toHex` gives upper-case `#RRGGBB[AA]` and clamps out-of-gamut colours.                   |
| `parseDimension`, `parseDuration`, `parseNumber`, `is*` | The scalar scanners (no regular expressions).                                                      |

Diagnostics use the shape of the parser: the element id and property of the
spec are `at.element` and `at.property`. `invalid-value` (error) also gives the
`expected` type as text; `reserved-sigil` (warning) is given for `@x` and `$x`
values, which are typed as strings.

The oklch <-> sRGB conversion uses the OKLab matrices published by
[Björn Ottosson](https://bottosson.github.io/posts/oklab/) and the sRGB
transfer function of CSS Color 4, in about fifty lines, so the package does
not depend on a colour library such as `culori`. Converting an in-gamut colour
there and back changes no channel by more than 0.001.

## API

| Export                                   | Purpose                                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parse(text, options?)`                  | Text to `{ roots, diagnostics }`. Options: `maxDepth` (64), `maxInputSize` (1 MiB), `mode` (`'auto'`, `'groups'` or `'fold'`), `checks` (`true`), `vocabulary`.            |
| `parseOrThrow(text, options?)`           | Same as `parse`, but throws `UiParseError` on an error diagnostic.                                                                                                         |
| `toTree(doc)`                            | The tree JSON of the specification: `{ spec, elements, unknown?, diagnostics }`.                                                                                           |
| `format(doc, { style, indent }?)`        | Tree back to text, in the `'inline'`, `'multiline'` (default) or `'indented'` style. `parse(format(doc))` gives the same tree.                                             |
| `parseLinks(text, options?)`             | Text to raw values (atoms as strings, links as arrays or `{ id, values }`), without the element projection, for formats such as the `ui-store` log. Throws `UiParseError`. |
| `formatLinks(values)`                    | Raw values back to text, one link per line. `parseLinks(formatLinks(v))` gives `v` back.                                                                                   |
| `walk(docOrNode, visitor)`               | Depth-first, pre-order visit `visitor(node, parent, depth)`; returning `false` skips the children.                                                                         |
| `projectLink(link)`, `projectLinks(...)` | Project `links-notation` `Link` objects you already have.                                                                                                                  |
| `defaultVocabulary()`, `loadVocabulary`  | The `ui-dialect/0` vocabulary of kinds, properties and actions, or your own one written in the same LiNo form.                                                             |
| `valueMatches(type, value)`              | Checks a value against a property type of the vocabulary.                                                                                                                  |
| `values`                                 | The value layer: see [Typed values](#typed-values).                                                                                                                        |
| `UI_DIALECT_VERSION`, `SPEC_VERSION`     | `'ui-dialect/0'`.                                                                                                                                                          |

Type declarations are in [`src/index.d.ts`](src/index.d.ts) and, for
`@link-foundation/ui-core/source`, [`src/source.d.ts`](src/source.d.ts).

The wider design is described in
[`docs/ARCHITECTURE.md`](https://github.com/link-foundation/ui/blob/main/docs/ARCHITECTURE.md).

## License

[Unlicense](LICENSE) (public domain).
