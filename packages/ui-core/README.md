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

## API

| Export                                   | Purpose                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parse(text, options?)`                  | Text to `{ roots, diagnostics }`. Options: `maxDepth` (64), `maxInputSize` (1 MiB), `mode` (`'auto'`, `'groups'` or `'fold'`), `checks` (`true`), `vocabulary`. |
| `parseOrThrow(text, options?)`           | Same as `parse`, but throws `UiParseError` on an error diagnostic.                                                                                              |
| `toTree(doc)`                            | The tree JSON of the specification: `{ spec, elements, unknown?, diagnostics }`.                                                                                |
| `format(doc, { style, indent }?)`        | Tree back to text, in the `'inline'`, `'multiline'` (default) or `'indented'` style. `parse(format(doc))` gives the same tree.                                  |
| `walk(docOrNode, visitor)`               | Depth-first, pre-order visit `visitor(node, parent, depth)`; returning `false` skips the children.                                                              |
| `projectLink(link)`, `projectLinks(...)` | Project `links-notation` `Link` objects you already have.                                                                                                       |
| `defaultVocabulary()`, `loadVocabulary`  | The `ui-dialect/0` vocabulary of kinds, properties and actions, or your own one written in the same LiNo form.                                                  |
| `valueMatches(type, value)`              | Checks a value against a property type of the vocabulary.                                                                                                       |
| `UI_DIALECT_VERSION`, `SPEC_VERSION`     | `'ui-dialect/0'`.                                                                                                                                               |

Type declarations are in [`src/index.d.ts`](src/index.d.ts).

The wider design is described in
[`docs/ARCHITECTURE.md`](https://github.com/link-foundation/ui/blob/main/docs/ARCHITECTURE.md).

## License

[Unlicense](LICENSE) (public domain).
