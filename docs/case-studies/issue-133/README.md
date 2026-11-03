# Case study: issue 133 — no issue templates, and the nested form of Links Notation by default

[Issue #133](https://github.com/link-foundation/ui/issues/133) (opened
2026-11-03 by `konard`) asks for two changes:

1. Remove the GitHub issue templates.
2. Write Links Notation in the **indented/nested** form by default, with as few
   parentheses as possible, in the docs, in all code "and so on". The inline
   form stays supported.

It also asks for a deep case study (this folder), for debug output where a
root cause is unclear, and for issues upstream with reproductions, workarounds
and fix suggestions. Everything is delivered in pull request
[#134](https://github.com/link-foundation/ui/pull/134).

## Contents

| Path                                                                                 | What it holds                                                                    |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [`data/issue-133.json`](data/issue-133.json)                                         | The issue as JSON (`gh issue view 133 --json ...`).                              |
| [`data/issue-133-comments.json`](data/issue-133-comments.json)                       | Its comments (none when this study was written).                                 |
| [`upstream/`](upstream/)                                                             | The text of the three issues reported to `link-foundation/links-notation`.       |
| [`../../../experiments/issue-133/`](../../../experiments/issue-133/)                 | Probes of the parser and formatter, conversion scripts and consumer snapshots.   |
| [`../../../scripts/lino-nest.mjs`](../../../scripts/lino-nest.mjs)                   | The converter that rewrites `.lino` files and ` ```lino ` blocks in nested form. |
| [`../../../tests/lino-nested-form.test.js`](../../../tests/lino-nested-form.test.js) | The regression test that keeps the repository in nested form.                    |

## The issue

> By default we should use links notation in indented/nested mode, where we
> minimize number of parantheses. See examples in official docs.
>
> So we can support inline links notation, but default in docs and in all
> places in code and so on is indented/nested.
>
> Also there is no need for issue templates in this repository.

The remaining paragraphs ask for this case study, for debug output, for
upstream reports, and for the change to be applied to the entire codebase in
one pull request.

The "official docs" are the README of
[`links-notation`](https://github.com/link-foundation/links-notation). Its
"Indented Structure" section shows that `3:` followed by the indented lines
`papa`, `loves` and `mama` is the same link as `(3: papa loves mama)`. Since
links-notation
[#282](https://github.com/link-foundation/links-notation/issues/282), a
parenthesized group also opens a nested indentation context.

## Timeline

All times are UTC on 2026-11-03.

| Time        | Event                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| before      | `main` (`e6fa208`) writes Links Notation in the **multi-line parenthesized** form: ui-core `format()` defaults to `style: 'multiline'`, the other writers call `Link.format()` or join parentheses by hand, and nearly every `.lino` file, fixture and docs example is written `(a: b\n  (c d))`.                                                                                       |
| 11:19       | Issue #133 is opened.                                                                                                                                                                                                                                                                                                                                                                   |
| 11:20       | Draft pull request #134 is opened on branch `issue-133-adf438e34311`.                                                                                                                                                                                                                                                                                                                   |
| 11:27       | `23713e9`: the Feature and Bug issue forms and `config.yml` are removed, with the test that read them and its `yaml` dependency.                                                                                                                                                                                                                                                        |
| 11:34       | `4fb9373`: ui-core `format` and `formatLinks` default to the nested style; `parseLinks` reads it back.                                                                                                                                                                                                                                                                                  |
| 11:37–11:52 | ui-tokens, ui-devmode, ui-settings, ui-store and ui-convert write the nested form. `parseNested` is added, and the readers of rules, mappings, charts, diagrams and vocabularies use it. `scripts/lino-nest.mjs` is added.                                                                                                                                                              |
| 11:58       | `db7dbc5`: converting the issue-1 samples shows the `moveNode` bug (root cause 4), which is fixed.                                                                                                                                                                                                                                                                                      |
| 12:02       | `d8c4fbb`: the Swift and Kotlin render-tree dumps write one node per line.                                                                                                                                                                                                                                                                                                              |
| 12:21       | `888b6f2`: the converter is fixed for lines with several links (root cause 5). The spec fixtures, the components and the remaining `.lino` files are converted.                                                                                                                                                                                                                         |
| 12:24       | `ed934a2`: the chart and diagram example pages fail in the browser (root cause 6). They are fixed, and `92ccb01` adds a test for the import maps of every example page.                                                                                                                                                                                                                 |
| 12:27–12:37 | The docs, README examples, dock layouts, charts, split sizes, diagrams, chart themes, asset records, attributions and vocabulary texts are converted.                                                                                                                                                                                                                                   |
| 12:39       | `5ec9684`: `tests/lino-nested-form.test.js` checks every `.lino` file and ` ```lino ` block.                                                                                                                                                                                                                                                                                            |
| 12:40       | `c8e99de`: AGENTS.md, the agent guide, the conventions and the projection spec state the default.                                                                                                                                                                                                                                                                                       |
| 12:42       | `0d47a1c`: the formatter and `parseGroups` are probed on `links-notation` 0.30.0, the latest release. Three problems remain there, and links-notation [#379](https://github.com/link-foundation/links-notation/issues/379), [#380](https://github.com/link-foundation/links-notation/issues/380) and [#381](https://github.com/link-foundation/links-notation/issues/381) are reported. |

In total, 358 files changed: 166 `.lino` files, 26 Markdown files, 133
JavaScript files, 5 Swift/Kotlin files and 3 example pages.

## Requirements

| #   | Requirement (from the issue)                                                                                                        | Delivered by                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Remove the issue templates.                                                                                                         | `23713e9`; `tests/contributor-guide.test.js` asserts that `.github/ISSUE_TEMPLATE` stays absent. The guides point at a plain new issue.                                                                                          |
| R2  | Nested form with as few parentheses as possible is the default **in code**.                                                         | ui-core `format`/`formatLinks` default; every writer in `packages/*/src` and `scripts/` uses `formatLinks` (list below).                                                                                                         |
| R3  | Nested form is the default **in docs** "and so on" (data files, fixtures, examples).                                                | All `.lino` files, ` ```lino ` blocks, example pages and embedded texts converted; `tests/lino-nested-form.test.js`; conventions and AGENTS.md updated.                                                                          |
| R4  | Inline LiNo stays supported.                                                                                                        | Every reader still reads the one-line and parenthesized forms; tests keep inputs in those forms (`DESIGNER_PARENS`, the `shapes/` fixtures, the old `(sizes 40 60)` value).                                                      |
| R5  | Deep case study in `docs/case-studies/issue-133`: data, timeline, requirements, root causes, solutions, libraries, online research. | This folder.                                                                                                                                                                                                                     |
| R6  | Debug output and a verbose mode where the root cause is unclear.                                                                    | `node scripts/lino-nest.mjs --verbose` (or `LINO_NEST_DEBUG=1`) traces every group and the values it reads; the probes in `experiments/issue-133/`.                                                                              |
| R7  | Report issues to other repositories with reproductions, workarounds and fix suggestions.                                            | links-notation [#379](https://github.com/link-foundation/links-notation/issues/379), [#380](https://github.com/link-foundation/links-notation/issues/380), [#381](https://github.com/link-foundation/links-notation/issues/381). |
| R8  | Apply the change to the entire codebase, in one pull request.                                                                       | #134; the regression test and the remaining-writer search below.                                                                                                                                                                 |

## Root causes

1. **The writer default was the multi-line parenthesized form.** ui-core
   `format()` on `main` used `style = 'multiline'`. The other writers each
   formatted on their own, with `Link.format()` (one line, full parentheses)
   or hand-built strings like `` `(${name} ${values})` ``. These included the
   dock layout, charts, split sizes, diagrams, chart themes, asset records,
   attributions, the store, settings, devmode, the converters and the
   Swift/Kotlin `dumpLino`. No shared nested writer existed, so each new
   writer copied the parentheses of the one before it, and so did the docs.
2. **The reader did not read the nested form back as it was written.**
   `Parser.parse` path-folds indented lines: `a b` followed by the indented
   line `c d` reads as `(a b) ((a b) (c d))`, not as `(a b (c d))`. The UI
   projection folds these paths (docs/spec/projection.md). The raw readers did
   not: rules, mappings, charts, diagrams, vocabularies and asset records read
   whole links with `Parser.parse`. Writing nested text would have broken
   them, so the parenthesized form was the only safe one to write. The fix is
   ui-core `parseNested`/`parseLinks`. They read with `Parser.parseGroups` and
   append the indented lines of a line to its values.
3. **The upstream formatter cannot write the nested form.** It was checked on
   0.27.1 and on 0.30.0, the latest release:
   - `lessParentheses` keeps every value inline.
   - The indented output of `FormatOptions` is one level deep, and for an
     anonymous link it writes no head line, so it reads back as other links.
   - `format(true)` of `((b c))` writes `(b c)`.
   - The upstream reports are [#379](https://github.com/link-foundation/links-notation/issues/379)
     and [#380](https://github.com/link-foundation/links-notation/issues/380).
4. **A source edit assumed that every element closes with `)`.** In the
   nested form nothing closes an element, so the place after an element can
   fall inside the lines of a node that is being moved out of it. `moveNode`
   refused such a move as "into itself". It now inserts at the line break
   before the removed lines (`db7dbc5`, with a test in ui-core). This showed
   up only when the issue-1 samples were converted.
5. **A line holding several links has its own meaning.** In the
   parenthesized form a continuation line `(a 1) (b 2)` is one list of links.
   Its readers, such as ui-settings `lineValues`, take each link as a value of
   its own. The first converter kept the list as one value. It was fixed in
   `888b6f2` and checked against the consumers
   (`experiments/issue-133/consumer-snapshot.mjs`).
6. **Example pages had incomplete import maps.** The chart and diagram readers
   now import ui-core. The pages had no `@link-foundation/ui-core` entry, so
   they failed in the browser before drawing anything. Fixed in `ed934a2`;
   `packages/ui-components/tests/examples-import-maps.test.js` now checks
   every page.
7. **`parse` and `parseGroups` disagree on a bare `name:` line.** `x:`
   followed by the lines `a` and `b` reads as `(x: a b)` with `parse` and as
   `(x: (a) (b))` with `parseGroups`. The nested writer therefore puts
   parentheses on a lone reference under a bare `name:`
   ([#381](https://github.com/link-foundation/links-notation/issues/381)).
8. **Issue templates.** They duplicated `docs/agents/writing-issues.md` and
   needed a YAML test and a `yaml` dependency to stay in sync. The issue
   states that they are not needed.

## Solutions

### ui-core: one writer and one reader

- `formatLinks(values, { style = 'indented', indent = '  ' })` takes raw
  values or `links-notation` links. It writes each link on one line with its
  atom values, and each value that is a link with values on its own line,
  indented. It keeps parentheses only where a line cannot hold the link:
  - `()`
  - `((a b))`
  - an anonymous link of links such as `(field product) (type nominal)`
  - a lone reference under a bare `name:` line
- `format(doc)` writes UI documents the same way.
- `parseLinks`/`parseNested` read the nested, one-line and parenthesized
  forms to the same links.
- `experiments/issue-133/fuzz-nested-format.mjs` checks the round trip
  `parseLinks(formatLinks(v)) = v` on random values.

### Every writer uses it

| Package / script    | Writer                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| ui-core             | `format`, `formatLinks`                                                                |
| ui-components       | dock layouts, charts and chart themes, diagrams, split sizes (`sizes 30 70`), machines |
| ui-convert          | HTML, JSX, Vue and interop importers, rules and mapping tables                         |
| ui-store            | bundles and logs                                                                       |
| ui-settings         | values documents                                                                       |
| ui-devmode          | element source panel                                                                   |
| ui-tokens           | DTCG import                                                                            |
| ui-swift, ui-kotlin | `dumpLino` render-tree dumps                                                           |
| scripts             | asset records (`NOTICE.lino`), attributions                                            |

### Every text is converted

`scripts/lino-nest.mjs` reads each group of lines with ui-core and writes it
with `formatLinks`. It keeps the quoting and blank lines, and it leaves a
group unchanged, with a note, when the group:

- holds a comment
- does not parse
- would read differently after the change

`--check` reports the files that would change, and `--verbose` traces every
group.

`tests/lino-nested-form.test.js` runs it over all tracked `.lino` files and
` ```lino ` blocks. The helpers in `experiments/issue-133/` convert LiNo
embedded in HTML pages, JavaScript literals, test literals and the render
snapshots.

### Exceptions kept on purpose

| Where                                                                      | Why                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Markdown table cells                                                       | A cell is one line.                                                       |
| devmode `formatValues`, ui-config `describeValues`                         | A one-line field or diagnostic message.                                   |
| ui-settings share URL (`style: 'inline'`)                                  | A URL is one line.                                                        |
| Source edits of ui-core                                                    | They keep the layout the author wrote.                                    |
| `docs/spec/fixtures/shapes/`, ui-core reader fixtures, inline test inputs  | They prove that the one-line and parenthesized forms still read the same. |
| `docs/spec/projection.md`, the "Three forms" section of the ui-core README | They show the forms side by side.                                         |
| Swift/Kotlin `*.render.lino` snapshots                                     | One-line dumps compared by the snapshot tests.                            |
| `docs/case-studies/issue-1/`, `experiments/`                               | History: the texts as they were written and probed.                       |

### Issue templates

`.github/ISSUE_TEMPLATE/` is removed. `docs/agents/writing-issues.md` and
`docs/CONTRIBUTING.md` describe the sections to write by hand.
`tests/contributor-guide.test.js` keeps the pull request template and agent
guide checks, and asserts that the templates stay removed.

## Existing libraries

- **`links-notation`** (0.27.1 is installed; 0.30.0 is the latest).
  - Reading: `Parser.parse` path-folds indented lines, and
    `Parser.parseGroups` returns the indentation tree.
  - Writing: `formatLinks`/`Link.format` with `FormatOptions`
    (`lessParentheses`, `maxInlineRefs`, `indentLongLines`, `preferInline`)
    writes one line, or one level of indentation.
  - 0.30.0 adds `parseIndentedDocument`/`formatIndentedDocument` (from
    links-notation [#333](https://github.com/link-foundation/links-notation/issues/333)),
    which handle text parents with one level of text children only.
  - No upstream function writes the recursive nested form, so ui-core keeps
    its own writer. It is offered upstream in
    [#380](https://github.com/link-foundation/links-notation/issues/380).
  - Updating to 0.30.0 is not needed for this issue: the three probes give
    the same results on both versions (`experiments/issue-133/*.0.30.0.txt`).
- **Swift and Kotlin ports** of links-notation: the render-tree dumps are
  written by our own `dumpLino` and read back with the ports in their tests.

## Online research

- The links-notation README describes the indented syntax as the more
  readable form: `3:` followed by indented `papa`, `loves`, `mama` equals
  `(3: papa loves mama)`. The Python binding exposes
  `format_links(links, less_parentheses=False)`, so fewer parentheses is
  opt-in upstream as well.
  ([GitHub](https://github.com/link-foundation/links-notation),
  [PyPI](https://pypi.org/project/links-notation/),
  [docs.rs](https://docs.rs/crate/links-notation/latest/source/README.md))
- YAML had the same debate between block style (indented) and flow style
  (bracketed). PyYAML's old default wrote flow style for collections of
  scalars. It was changed to block style
  ([yaml/pyyaml#256](https://github.com/yaml/pyyaml/pull/256)) after being
  called "probably the most annoying default in PyYAML". Block style is
  generally preferred for files that people edit, and flow style is kept for
  short lists. This matches the choice here: nested by default, inline only
  where a single line is required.
- KDL nests with braces and allows several nodes on one line only with `;`
  terminators. Children, not properties, carry ordered data
  ([KDL spec](https://github.com/kdl-org/kdl/blob/main/SPEC.md)). LiNo's
  nested form gets the same tree from indentation alone, without closing
  delimiters. This is also why the `moveNode` source edit (root cause 4) had
  to stop relying on a closing `)`.

## Upstream reports

All three were reproduced on `links-notation` 0.27.1 and 0.30.0, with no
duplicates found among the 378 existing issues and pull requests:

- links-notation [#379](https://github.com/link-foundation/links-notation/issues/379):
  `Link.format(true)` of `((b c))` gives `(b c)`
  ([text](upstream/1-format-drops-nesting.md)).
- links-notation [#380](https://github.com/link-foundation/links-notation/issues/380):
  no formatter option writes the nested form recursively, and the indented
  output of an anonymous link does not read back
  ([text](upstream/2-nested-formatter.md)).
- links-notation [#381](https://github.com/link-foundation/links-notation/issues/381):
  `parse` and `parseGroups` read one-word lines under a bare `x:` line
  differently ([text](upstream/3-parse-vs-parsegroups.md)).

## Verification

- `npm test`, `npm run lint`, `npm run format:check` and
  `npm run check:duplication` pass, and the CI of #134 runs them along with
  the browser, Swift and Kotlin jobs.
- `node scripts/lino-nest.mjs --check $(git ls-files '*.lino')` reports only
  the allowlisted files.
- `node --test tests/lino-nested-form.test.js` fails when a parenthesized
  multi-line link is added to any other `.lino` file or ` ```lino ` block.
