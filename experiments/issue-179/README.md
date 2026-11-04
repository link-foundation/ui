# React scheduler environment race (#179)

The original Ubuntu/Deno job (Deno 2.9.8) failed all five document tests at
`ReactDOMRoot.render` with `now is not a function`; the unchanged rerun passed.
[Original log](https://github.com/link-foundation/ui/actions/runs/41759898763/job/126345265444),
lines 6152–6163, identifies React DOM 19.3.1's scheduler clock, but does not
record the environment at module evaluation time.

The confirmed mechanism is a shared environment race. Deno test workers share
OS environment variables. The production-warning test in
`packages/ui-react/tests/actions.test.js` temporarily wrote
`process.env.NODE_ENV = 'production'`. Scheduler 0.28.0 reads that variable in
`index.js` to choose the development module, then again in
`cjs/scheduler.development.js` to decide whether to populate its exports.
A production value at the second read leaves an empty object. React DOM captures
its missing `unstable_now` as `now` and fails on the first render. Node's separate
test processes do not share this environment. The short mutation window explains
why an isolated document run can pass and full Deno runs can fail intermittently.
The old job did not trace those reads, so its exact interleaving is inferred from
the reproduced mechanism and the matching stack, rather than observed directly.

## Bounded reproduction

After `npm ci`, run:

```sh
deno run -A --node-modules-dir=manual experiments/issue-179/scheduler-env.mjs
```

This uses a real Deno worker and real installed React/scheduler modules. A proxy
coordinates the environment reads with the worker; each handshake has a finite
five-second limit. It does not replace scheduler exports or patch dependencies.
The worker restores the environment before React DOM finishes importing.
Observed with Deno 2.9.7, React/React DOM 19.3.1, scheduler 0.28.0:

```text
scheduler development guard sees worker NODE_ENV: production
versions: 19.3.1 19.3.1 0.28.0
scheduler exports: []
Reproduced ReactDOMRoot.render: now is not a function
```

The experiment deliberately reproduces the external mutation even after the test
fix. It is a diagnostic, not a passing regression for the corrected test.

## Regression and fix

The action test records every parent `NODE_ENV` write/deletion, including temporary
ones. With the old implementation it fails:

```text
Expected [["NODE_ENV","production"],["NODE_ENV",null]] to equal []
```

The production assertions now run in `production-actions.mjs` in a child of the
same runtime with production specified only in its environment. They still check
that missing actions return false without warning and that registered handlers run.
The parent write guard passes without weakening any document assertions or
skipping tests. The existing 25-second child-process hang guard applies.
No framework behavior, rendering, or dependencies change; no screenshot is needed.

For opt-in module-export diagnostics:

```sh
UI_REACT_TEST_DEBUG=1 node --test packages/ui-react/tests/document.test.js
```

The same variable works under Deno. It reports runtime, environment, dependency
versions, scheduler path/export names and clock type after client import. Normal
tests leave it disabled and retain their import order.

## Verification

```sh
node --test packages/ui-react/tests/actions.test.js packages/ui-react/tests/document.test.js
deno test -A --parallel packages/ui-react/tests/actions.test.js packages/ui-react/tests/document.test.js
bash scripts/run-with-budget-warning.sh 300 'Deno test suite' deno test -A --parallel
npm test -- --test-concurrency=2
npm run lint
npm run format:check
npm run check:duplication
```

Local Deno runs can use `--node-modules-dir=manual --no-check` with an npm-owned
installation; CI uses the unmodified Deno command and its own installation,
including type checking. Do not concurrently run npm and Deno auto-installers
against the same `node_modules` directory.
