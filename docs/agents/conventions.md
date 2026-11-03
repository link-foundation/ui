# Conventions for every change

These rules apply to every change in this repository, made by a person or by an
AI agent. They are the canonical copy of the conventions footer that the
roadmap issues carry
([`docs/case-studies/issue-1/roadmap/issue-footer.md`](../case-studies/issue-1/roadmap/issue-footer.md),
kept unchanged as a case-study record). When the two differ, this file wins.

The roadmap was planned in
[issue #1](https://github.com/link-foundation/ui/issues/1). The full plan, the
requirement list and the research are in the
[issue 1 case study](../case-studies/issue-1/README.md), and the target design
is in [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md).

- **Read first:** [`AGENTS.md`](../../AGENTS.md),
  [`docs/CONTRIBUTING.md`](../CONTRIBUTING.md),
  [`docs/javascript-first.md`](../javascript-first.md) and
  [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md).
- **Links Notation first.** Every new format (documents, configuration,
  tokens, styles, animations, recordings, asset records) is Links Notation
  parsed with the official `links-notation` package (or the official port for
  Swift and Kotlin). Never hand-write a LiNo parser with regular expressions.
  JSON, CSS, JSX and so on are only import or export formats. Write it in the
  [nested form](#links-notation-in-the-nested-form).
- **JavaScript first.** Plain ES modules (`.js`/`.mjs`) with JSDoc types;
  TypeScript declaration files (`.d.ts`) are allowed for public APIs. Swift and
  Kotlin ports must pass the same shared fixtures as the JavaScript code.
- **Tests:** `node --test` (see `package.json`). Every behaviour change has a
  test that fails before the change. Keep tests deterministic: no network, no
  real clock (inject time), no random seeds without a fixed value.
- **Quality gates:** `npm run lint`, `npm run format:check`,
  `npm run check:duplication` and `npm test` must pass. Files stay under
  1,500 lines (`scripts/check-file-line-limits.sh`).
- **Releases:** a change to a published package needs a changeset
  (`npx changeset`), as described in
  [`docs/CONTRIBUTING.md`](../CONTRIBUTING.md) and
  [`docs/monorepo.md`](../monorepo.md).
- **Licensing:** the repository is public domain (Unlicense). Our own assets
  are CC0-1.0. A third-party dependency or asset must use a permissive licence
  (MIT, ISC, BSD, Apache-2.0, CC0, CC-BY with attribution recorded) and be
  recorded as described in [`docs/licensing.md`](../licensing.md). Do not add
  GPL, AGPL, non-commercial or "source available" code or assets.
- **Accessibility:** interactive UI follows the WAI-ARIA Authoring Practices,
  works with the keyboard, respects `prefers-reduced-motion` and
  `prefers-color-scheme`, and meets WCAG 2.2 AA contrast.
- **Scope discipline:** do only what the issue asks. If you find a defect or
  a missing prerequisite, open a new issue (type Bug or Feature) and link it,
  instead of widening the pull request.
- **Done means:** every acceptance criterion is checked, CI is green, and the
  pull request description says `Fixes #<issue>` and shows how each
  criterion was verified (command output or screenshots for UI).

## Links Notation in the nested form

Links Notation is written in the **nested form** by default, in documents,
examples and code ([#133](https://github.com/link-foundation/ui/issues/133)).
A link goes on one line with its atom values. Each value that is itself a
link with values goes on its own line, indented two spaces under it.
Parentheses are left out wherever indentation makes them unneeded:

```lino
ok: button
  label OK
  on press
    navigate home
```

and not the multi-line parenthesized form

```text
(ok: button
  (label OK)
  (on press (navigate home)))
```

- All forms read the same, and ui-core keeps reading the one-line and
  parenthesized forms. Only the form that is written changes.
- Code writes Links Notation with `formatLinks` of ui-core, whose default
  style is the nested form. It takes raw values and `links-notation` links.
  Do not call `Link.format()` or join parentheses by hand.
- A link of links with no head, such as one tooltip field, needs
  parentheses: `(field product) (type nominal)`. Parentheses also stay
  wherever the text must fit on one line: a Markdown table cell, a URL, a
  one-line form field or a diagnostic message.
- `node scripts/lino-nest.mjs <file.lino|file.md>...` rewrites a file in the
  nested form (`--check` only reports). `tests/lino-nested-form.test.js`
  checks every `.lino` file and every ` ```lino ` block. Its allowlist
  covers the files that keep the other forms on purpose: the spec fixtures,
  the reader fixtures and the history.
