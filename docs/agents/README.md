# Agent workflow guide

This guide explains how an AI coding agent (or a person) picks, plans,
implements, verifies and hands off work in this monorepo. Start at
[`AGENTS.md`](../../AGENTS.md) for the repository map and the required
commands, and follow [`conventions.md`](conventions.md) for every change. To
write a new issue, read [`writing-issues.md`](writing-issues.md).

Issues use one body template (Context, Goal, Scope, Dependencies, Step-by-step
plan, Files to create or change, Acceptance criteria, How to verify, Prior art
and libraries, References). The sections below follow that template.

## Pick an issue

1. Open the issue and read it completely, including every comment.
2. Read the **Dependencies** section first. Check that every `Blocked by`
   issue is closed (`gh issue view <N> --json state`).
3. If a blocker is still open, work against a stub only when the issue says
   so. Stub the blocked API with the documented signature and mark it with a
   `TODO(#<blocker>)` comment. Never fake the blocked behaviour in tests: a
   test that depends on it is skipped with a visible reason, not made green.
4. If the blocker is open and the issue does not allow a stub, pick another
   issue.

## Plan

- Follow the numbered **Step-by-step plan** of the issue in order.
- One commit per step is fine; each commit should leave the tree green.
- Keep the list of **Files to create or change** as your checklist. If you
  need a file that is not on the list, check that it is within the issue's
  **In scope** list first.
- Map every **Acceptance criterion** to the step that delivers it and to the
  check that proves it.

## Write tests first

- Write the test before the change and run it on its own:

  ```bash
  node --test packages/<name>/tests/<file>.test.js
  ```

  It must fail before the change and pass after it.

- Repository-level tests live in `tests/*.test.js`; package tests live in
  `packages/<name>/tests/`. `npm test` runs both.
- Keep tests deterministic: no network, no real clock, fixed random seeds.
- Use the shared fixtures in `docs/spec/fixtures/` when a behaviour is
  defined by the dialect specification.

## LiNo first

- Every new format is Links Notation, parsed with the official
  `links-notation` package. Never parse LiNo with regular expressions.
- For any question about the UI dialect (elements, values, ordering, IDs,
  projection), read [`docs/spec/`](../spec/README.md) and its fixtures. If
  the specification does not answer the question, record it in
  [`docs/spec/open-questions.md`](../spec/open-questions.md) or open an issue;
  do not invent new syntax silently.
- JSON, CSS, JSX and other formats are import or export formats only.

## Verify UI

- Any change that renders UI needs a visual and accessibility check:

  ```bash
  npm run test:ui          # local browsers
  npm run test:ui:docker   # the pinned container used by CI
  ```

- Update baselines only on purpose (`npm run test:ui:update`) and review
  every changed image.
- Attach screenshots of the changed UI to the pull request. Commit them to
  the branch and link them with
  `https://github.com/link-foundation/ui/blob/<branch>/<path>?raw=true`.
- [`docs/testing-ui.md`](../testing-ui.md) explains projects, baselines and
  the axe-core audit.

## Licensing

- Read [`docs/licensing.md`](../licensing.md) before adding a dependency or an
  asset. Only permissive licences are allowed (MIT, ISC, BSD, Apache-2.0,
  CC0, CC-BY with attribution recorded).
- Record every third-party asset in `assets/assets.lino` and run:

  ```bash
  npm run check:assets
  ```

## Changesets

- A change to a published package under `packages/` needs a changeset:

  ```bash
  npx changeset
  ```

  Pick the package (for example `@link-foundation/ui-core`) and the bump
  type. Commit the generated file in `.changeset/`.

- Documentation-only changes do not need one. See
  [`docs/monorepo.md`](../monorepo.md) and
  [`docs/CONTRIBUTING.md`](../CONTRIBUTING.md) for the rules the CI guard
  enforces.

## Hand-off

- Run the four required commands from [`AGENTS.md`](../../AGENTS.md) on the
  exact revision you push.
- The pull request description starts with `Fixes #<N>` (one line per issue
  it closes) and lists every acceptance criterion with its evidence: the
  command and its output, a test name, or a screenshot.
- Fill in the [pull request template](../../.github/pull_request_template.md)
  checklist. Leave an unmet criterion unchecked and say why; never present
  blocked work as done.
- Wait for CI to be green before marking the pull request as ready.

## When stuck

- Do not widen the scope of the pull request. Open a new issue with the
  [Bug or Feature form](https://github.com/link-foundation/ui/issues/new/choose)
  and link it from the pull request.
- If a blocker turns out to be missing, say so in the pull request and in the
  new issue, with the evidence (logs, failing command, CI run URL).
- If the issue itself is unclear, write down the assumption you chose in the
  pull request description.
