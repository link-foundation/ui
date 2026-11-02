# Native Links Notation parsers

The JavaScript core reads Links Notation (LiNo) with the
[`links-notation`](https://github.com/link-foundation/links-notation) package.
Native renderers must read the same documents the same way, so each one needs
a parser that behaves exactly like that package. This page records where those
parsers live and how they are kept in step with it.

| Language | Where                                                         | Status   | Issue                                                  |
| -------- | ------------------------------------------------------------- | -------- | ------------------------------------------------------ |
| Swift    | [`native/swift/LinksNotation`](../native/swift/LinksNotation) | vendored | [#29](https://github.com/link-foundation/ui/issues/29) |

## Swift

### Decision: vendored here until upstream decides

`links-notation` has bindings for JavaScript, Rust, Python, Java, Go, C#, PHP
and C++, but none for Swift. The preferred home for a Swift port is upstream,
next to the others. The proposal is
[link-foundation/links-notation#369](https://github.com/link-foundation/links-notation/issues/369)
("Add Swift implementation"). It suggests:

- a `swift/` folder;
- a `swift` entry in `parity/language-features.json`;
- distribution through SwiftPM.

Upstream has not yet decided whether it wants a Swift folder. If it does, it
must also choose a layout, because SwiftPM needs `Package.swift` at the root of
the repository it fetches. The two options are a root `Package.swift` whose
targets point at `swift/Sources/LinksNotation`, or a separate repository.

Until then, the port is **vendored here** in `native/swift/LinksNotation`. Its
layout (`Package.swift`, `Sources/LinksNotation`, `Tests/LinksNotationTests`)
lets it move upstream unchanged, as `swift/`. When it moves, the SwiftUI
renderer ([#30](https://github.com/link-foundation/ui/issues/30)) should depend on the upstream package and this copy should be
deleted.

### The package

- `swift-tools-version` 5.9; platforms macOS 13+, iOS 16+ and Linux; no
  dependencies. CI uses Swift 6.4.
- Public API:
  - `Link` (`id`, `values`, `format()`, `Equatable`, `Sendable`);
  - `Parser(options:)` with `parse(_:) throws -> [Link]`;
  - `ParserOptions(maxDepth: 64, maxInputSize: nil)`;
  - `ParseError`: `.syntax(line:column:message:)`, `.depthExceeded(Int)` and
    `.inputTooLarge(Int)`;
  - `formatLinks(_:)`.
- It is a hand-written port of `links-notation` 0.27.1, the version this
  repository pins. That means `grammar.pegjs`, `Parser.js`, `ParseError.js`,
  `quotes.js`, `comments.js` and `ReferenceLiteral.js`. The grammar keeps
  Peggy's ordered choice and its expectation messages (`Expected ":" but "x"
found.`). Lines end at CR, LF and CRLF, and columns count UTF-16 code units,
  exactly as in `ParseError.js`.
- Depth follows the JavaScript accounting: every parenthesised group and every
  indentation level counts. With the default `maxDepth` of 64, 64 nested
  groups parse and 65 throw `.depthExceeded(64)`.

#### Not ported

These are out of scope for [#29](https://github.com/link-foundation/ui/issues/29). They should be explicit exceptions in the
upstream `parity/README.md`, as Python, PHP and Go already make for
`LinksGroup`:

- `LinksGroup`;
- streaming parsing;
- the binary protocol;
- `parseIndentedDocument`.

#### Additions and differences

- **Locating errors:** `Parser.parseLocated(_:)` throws `LocatedParseError(error:line:column:)`.
  It gives the position of `.depthExceeded` too, which the conformance
  diagnostics need (`docs/spec/limits.md`). `.inputTooLarge` has no position
  because the document is refused before it is read.
- **`ParserOptions.comments`:** set it to `false` and `#` becomes an ordinary
  character, like the `comments: false` option of the JavaScript parser.
- **Default input size:** `maxInputSize: nil` means `defaultMaxInputSize`
  (10 MiB, the JavaScript default), measured in UTF-16 code units.
  `docs/spec/limits.md` caps documents at 1 MiB, so pass
  `maxInputSize: 1_048_576` for untrusted documents.
- **Invalid reference literals:** the JavaScript parser throws a plain `Error`
  without a position for a literal such as `~1{zz}`. The port throws
  `.syntax(line:column:message:)` with the same message and the position of
  the literal.

### Tests

```bash
cd native/swift/LinksNotation && swift test
```

- `ParityTests` checks every case of the upstream parity corpus,
  `parity/text-fixtures.json` (14 cases). For each case it checks that `parse`
  gives the expected links, that `formatLinks` gives the expected text, and
  that parsing that text gives the same links again. The corpus is a
  byte-for-byte copy of upstream `main` at
  [`b7941c9`](https://github.com/link-foundation/links-notation/blob/b7941c94ec53e5e81934b1c98f6e54b952586320/parity/text-fixtures.json).
  `tests/parser-vectors.test.js` checks that the copy still agrees with the
  JavaScript package this repository pins.
- `SpecVectorsTests` checks every entry of
  [`docs/spec/parser-vectors.json`](spec/parser-vectors.json) with the limits
  of `docs/spec/limits.md`:
  - a valid document must give `expected` and `format`, and round-trip;
  - an `error` vector must throw that exact `ParseError` at that line and
    column.
- `LimitsTests` covers the limits:
  - `maxDepth` for groups and for indentation, both at the default and at a
    smaller value;
  - `maxInputSize`, counted in UTF-16 code units, including the default.
- `DifferentialTests` replays random documents written by
  `experiments/differential-vectors.mjs` together with what the JavaScript
  parser made of them. It is skipped unless `LINKS_NOTATION_VECTORS` is set:

  ```bash
  node experiments/differential-vectors.mjs 20000 42 8 > /tmp/diff.json   # count seed maxDepth
  cd native/swift/LinksNotation
  LINKS_NOTATION_VECTORS=/tmp/diff.json LINKS_NOTATION_MAX_DEPTH=8 swift test --filter Differential
  ```

  When the port was written, 120,000 documents (seeds 42, 7 and 1234 at depth
  8, and depths 1, 2 and 3) showed no differences. That includes thousands of
  syntax errors, each with the exact line, column and message, plus depth
  errors and invalid literals.

The [Swift workflow](../.github/workflows/swift.yml) runs `swift test` on
Linux, in the official `swift` image pinned by digest, and on macOS. It runs
whenever `native/swift/**` or `docs/spec/**` changes. The issue asked for
`ubuntu-latest` and `macos-latest`, but the repository's CI policy
(`scripts/check-ci-workflows.mjs`) requires pinned runner images, so the
workflow uses `ubuntu-24.04` and `macos-15`.

## Parser vectors

[`docs/spec/parser-vectors.json`](spec/parser-vectors.json) records what the
reference parser makes of every conformance fixture
(`docs/spec/fixtures/**/*.lino`). It lets every native port check itself
without Node.js. The Kotlin port ([#31](https://github.com/link-foundation/ui/issues/31)) is meant to reuse it.

The file is a JSON array with one vector per line, in fixture path order. The
`id` is the fixture path below `fixtures/`, without `.lino`.

- **A fixture that parses** gives `{id, input, expected, format}`:
  - `expected` is the list of links as `{id, values}` trees, where `id: null`
    marks an anonymous link, as in the upstream corpus;
  - `format` is what `formatLinks` writes for them.
- **A `syntax-*` fixture** must be refused. It gives
  `{id, input, error: true, code, line, column, message}`:
  - `code` is `syntax-error` or `depth-exceeded`;
  - `line` and `column` are where the reference parser stops, and match the
    fixture's `.diagnostics.json`;
  - `message` is the reference parser's message.

[`scripts/generate-parser-vectors.mjs`](../scripts/generate-parser-vectors.mjs)
writes the file with the pinned `links-notation` and the limits of
`docs/spec/limits.md`. It refuses to write a vector when either of these
happens:

- a `syntax-*` fixture parses;
- a formatted document does not read back the same.

```bash
node scripts/generate-parser-vectors.mjs          # rewrite after changing fixtures or links-notation
node scripts/generate-parser-vectors.mjs --check  # exit 1 when stale
node --test tests/parser-vectors.test.js          # freshness and consistency, also part of npm test
```
