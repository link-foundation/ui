# Agent guide

`link-foundation/ui` is an associative UI framework: documents, configuration,
styles and animations are written in Links Notation (LiNo). Read
[`docs/agents/README.md`](docs/agents/README.md) (workflow) and
[`docs/agents/conventions.md`](docs/agents/conventions.md) (rules for every
change) before you start.

## Repository map

- `packages/*`: publishable workspace packages named `@link-foundation/ui-*`
  (see [`docs/monorepo.md`](docs/monorepo.md)).
- `docs/spec/`: the UI dialect specification and its conformance fixtures.
- `docs/ARCHITECTURE.md`: the target design.
- `assets/`: our own assets and third-party asset records (`assets.lino`).
- `examples/`: runnable usage examples; `experiments/`: research scripts.
- `scripts/`: release, CI and quality-gate tooling; `tests/`: repository tests.

## Commands that must pass

```bash
npm test
npm run lint
npm run format:check
npm run check:duplication
```

## Rules

- Read the issue's **Dependencies** section first. If a blocker is still open,
  stub the blocked API as the issue says; never fake it in tests.
- Parse LiNo with the official `links-notation` package, never with regular
  expressions.
- Do only what the issue asks; open a new issue for anything else
  ([Bug or Feature form](https://github.com/link-foundation/ui/issues/new/choose)).
- Work in bulk. Workers may edit and test; exactly one coordinator owns
  `git push`. Never let two workers push the same branch.
- Run the required checks on the exact revision you push and review the whole
  diff first. Collect every CI failure of a revision before the next push.
- Merge, release and deployment need their own explicit authorisation.
- Use bounded builds. Do not delete user-owned dependencies, build directories
  or caches without explicit authorisation.
