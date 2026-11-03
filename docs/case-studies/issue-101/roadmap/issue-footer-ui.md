## Conventions for this issue

This issue was planned in
[issue 101](https://github.com/link-foundation/ui/issues/101) (pull request
[#108](https://github.com/link-foundation/ui/pull/108)). The requirements,
the research and the decisions are in the
[issue 101 case study](https://github.com/link-foundation/ui/tree/main/docs/case-studies/issue-101),
and the doublets MVP it builds on is
[`packages/ui-links`](https://github.com/link-foundation/ui/tree/main/packages/ui-links).

- **Read first:** `AGENTS.md`, `docs/CONTRIBUTING.md`,
  `docs/javascript-first.md`, `docs/ARCHITECTURE.md` and
  `packages/ui-links/README.md`.
- **One interface.** Every storage, decorator and client keeps the doublets
  interface of `packages/ui-links` (`create`, `update`, `delete`, `count`,
  `each`), so layers stay replaceable and stack.
- **Links Notation first.** Wire formats are Links Notation (text or the
  binary codec of `links-notation`), parsed with the official packages, never
  with regular expressions.
- **Tests:** `node --test`, and the same files under Bun and Deno in CI.
  Every behaviour change has a test that fails before the change; a test that
  cannot run on a runtime is skipped visibly, with the reason in its name.
- **Quality gates:** `npm run lint`, `npm run format:check`,
  `npm run check:duplication` and `npm test` pass; a change to a published
  package has a changeset.
- **Licensing:** only permissive dependencies (MIT, ISC, BSD, Apache-2.0,
  CC0, Unlicense).
- **Done means:** every acceptance criterion is checked, CI is green, and the
  pull request says `Fixes #<this issue>` and shows how each criterion was
  verified.
