# UI dialect specification, version `ui-dialect/0`

This directory is the normative contract for reading Links Notation (LiNo)
documents as a UI element tree. Every implementation (the JavaScript
`ui-core` of #14 and #15, the Swift port of #29, the Kotlin port of #31) and
every renderer MUST follow it and MUST pass the shared fixtures in
[`fixtures/`](fixtures/).

## Version

The version string of this specification is `ui-dialect/0`. Every expected
tree and diagnostics file carries it in its `spec` field. Version 0 is a draft
contract: a later version MAY change any rule, and then MUST use a new version
string (`ui-dialect/1`, ...).

## Keywords

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY" and "OPTIONAL" in these documents are to
be interpreted as described in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they
appear in all capitals.

## Documents

| Document                                             | Content                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| [elements.md](elements.md)                           | Element model and the property / child / unknown rule      |
| [projection.md](projection.md)                       | Tree projection of the three parse shapes (path folding)   |
| [values.md](values.md)                               | Value grammar, types, colours, references and JSON form    |
| [ordering-and-ids.md](ordering-and-ids.md)           | Sequences, sets, duplicates, ids and scoping               |
| [behaviour.md](behaviour.md)                         | Event handlers, actions, bindings; handlers are not code   |
| [limits.md](limits.md)                               | Depth, input size, unknown kinds and the diagnostics table |
| [open-questions.md](open-questions.md)               | Undecided points, their alternatives and owner issues      |
| [themes.md](themes.md)                               | Theme packages, modes, templates and subtree boundaries    |
| [vocabulary.lino](vocabulary.lino)                   | Machine-readable v0 kinds, properties and actions          |
| [element-tree.schema.json](element-tree.schema.json) | JSON Schema 2020-12 of the expected fixture output         |

The parser is the official [`links-notation`](https://github.com/link-foundation/links-notation)
package (measured with version 0.27.1) or its official port. Implementations
MUST NOT read LiNo with a hand-written parser.

## Fixtures

Fixtures live in `fixtures/<area>/<name>.lino`. Each `.lino` file MUST have
exactly one sibling:

- `<name>.tree.json`: the expected element tree, with the diagnostics the
  input produces (possibly none). Used in every area except `errors/`.
- `<name>.diagnostics.json`: only the expected diagnostics. Used in
  `errors/`, where the fixture exists to prove a diagnostic.

Both forms are described by [`element-tree.schema.json`](element-tree.schema.json).

Naming rules:

- `errors/syntax-*.lino` MUST be rejected by the LiNo parser itself (syntax
  error or nesting too deep). Every other `.lino` MUST parse.
- `shapes/<group>.<form>.lino` (for example `button.one-line.lino`,
  `button.multi-line.lino`, `button.indented.lino`) is one document written
  in several forms. All `.tree.json` files of one group MUST be byte-equal.
- `samples/<name>.lino` is a byte-equal copy of
  `docs/case-studies/issue-1/samples/<name>.lino`.

| Area          | Content                                                  |
| ------------- | -------------------------------------------------------- |
| `shapes/`     | One-line, multi-line and indented forms of one document  |
| `elements/`   | Element model, positional values, ids and kinds          |
| `properties/` | Declared properties, duplicates, multi-valued order      |
| `values/`     | Colours, dimensions, durations, URLs, `(or ...)`, typing |
| `references/` | Token, parameter and element references, sigils          |
| `behaviour/`  | `on` handlers and actions                                |
| `errors/`     | Inputs that exist to prove a diagnostic                  |
| `samples/`    | The issue-1 case study samples                           |

A conformance runner compares its output with the expected JSON as data (key
order inside objects is not significant). The order of `diagnostics` is not
significant; the order of every other array is.

## Checking

```bash
npm run check:spec                  # scripts/check-spec-fixtures.mjs
node --test tests/spec-fixtures.test.js
```

The checker parses every fixture and every fenced `lino` block of these
documents with `links-notation`, validates every JSON against the schema,
compares the `shapes/` groups byte for byte, and runs the non-normative
reference projection ([`scripts/spec-reference-projection.mjs`](../../scripts/spec-reference-projection.mjs))
against every expected JSON. The reference projection exists only to keep the
fixtures honest; the documents in this directory are the authority. To
regenerate the expected JSON after a deliberate spec change, run
`node experiments/issue-11/generate-fixtures.mjs`, then `npx prettier --write
docs/spec`, and review the diff by hand.
