# Site build timeout on the Windows Deno shard

[Issue #246](https://github.com/link-foundation/ui/issues/246) reports that
`packages/site/tests/build.test.js` timed out after 60 s on
`Test runtimes (windows-2025, deno, 1/3)`, and that a retry of the same commit
passed. This document records the evidence, the root cause and the changes.

## Tracing a build

`SITE_BUILD_TRACE=1` prints one `[site-build]` line per build phase on stderr.
Without it the build and the tests print nothing new.

```bash
SITE_BUILD_TRACE=1 node --test packages/site/tests/build.test.js
```

```text
[site-build] child spawn (at 1ms)
[site-build] vite config (at 574ms)
[site-build] generate pages: 1486ms (at 2061ms)
[site-build] bundle modules: 5672ms (at 7803ms)
[site-build] render chunks: 5925ms (at 13729ms)
[site-build] append gallery: 48ms (at 13777ms)
[site-build] render matrices: 4586ms (at 18362ms)
[site-build] write files: 493ms (at 18856ms)
[site-build] build closed (at 18856ms)
[site-build] child exit (at 19119ms)
[site-build] child close (at 19120ms)
[site-build] verify output: 4034ms (at 23154ms)
```

Lines from the Vite process carry its own clock; `child …` and `verify output`
lines carry the test's clock. Both start within a millisecond of each other.

| Phase           | Where it is measured                                                      |
| --------------- | ------------------------------------------------------------------------- |
| vite config     | `config` hook of `linoPages` in `packages/site/vite-plugin-lino-pages.js` |
| generate pages  | `generate()`: themes, CSS and the pre-rendered `.lino` pages              |
| bundle modules  | Rollup `buildStart` to `buildEnd`                                         |
| render chunks   | `buildEnd` to the `generateBundle` post hook (minification included)      |
| append gallery  | `appendGallery()`                                                         |
| render matrices | `emitMatrices()`: one page per example, theme and language                |
| write files     | `generateBundle` to `closeBundle`                                         |
| child …         | `spawn`, `exit` and `close` of the Vite process, timed by the test        |
| verify output   | the existing assertions on `dist/`                                        |

The tracer lives in `packages/site/build-trace.js`. The test streams the
child's stderr while tracing, so a cancelled build still shows its last phase.
The Deno step of `.github/workflows/release.yml` sets `SITE_BUILD_TRACE: '1'`.

## Evidence from CI

`experiments/issue-246/windows-shard-durations.sh` reads the Windows Deno
shard 1/3 job of every attempt of the `Checks and release` runs from 42709325900,
the reported failure, to 42807960525.

| Code                             | Jobs | Failed at 60 s | Passing durations |
| -------------------------------- | ---: | -------------: | ----------------- |
| before 5cc0d7c (to `afef74b`)    |   14 |              7 | 38–53 s           |
| from 5cc0d7c (`094510c` onwards) |   27 |              0 | 17–39 s           |

The failing job of the report,
[run 42709325900 attempt 1](https://github.com/link-foundation/ui/actions/runs/42709325900/attempts/1),
ends with:

```text
'Vite emits all pre-rendered entries and deployable assets for /ui/' has been running for over (1m0s)
./packages/site/tests/build.test.js => Vite emits all pre-rendered entries and deployable assets for /ui/ ... FAILED (1m0s)
error: Error: test timed out after 60000ms
FAILED | 1101 passed (17 steps) | 1 failed (1m1s)
```

Runs 42715406472 and 42716746558 failed in both attempts the same way.

## Root cause

The build does a fixed amount of CPU work that was close to the 60 s limit on
a four-vCPU Windows runner, where `deno test --parallel` runs other test files
next to the Vite child process.

1. Before 5cc0d7c, `emitMatrices()` parsed every example three times. The
   [profile of issue #228](../../../experiments/issue-228/site-build-profile.md)
   shows 9.6 s in that function. 5cc0d7c parses each example once.
2. `virtual:site-themes` inlines the whole resolved theme registry into the
   client bundle as one JSON string: 33.3 MB for 44 themes
   (`node experiments/issue-246/theme-module-size.mjs`). Rollup parses it and
   esbuild minifies it, so `assets/main-*.js` is 32 MB.
3. Other test files of the same shard compete for the cores. The reproduction
   below shows the build phases growing by 20–40 % under the parallel shard.

The matrix fix removed the margin problem: no Windows shard has failed since.
The remaining cost is dominated by the inlined theme registry.
`experiments/issue-246/theme-module-cost.sh` builds the site twice on two cores,
once as shipped and once with only the `base` theme inlined:

| Phase          | All themes | Only `base` |
| -------------- | ---------: | ----------: |
| bundle modules |    4694 ms |     2633 ms |
| render chunks  |    6492 ms |     1263 ms |
| write files    |     428 ms |      117 ms |
| `main-*.js`    |      32 MB |      696 KB |

Changing what the site ships is outside this issue, so the theme registry is
tracked in [issue #259](https://github.com/link-foundation/ui/issues/259).

## Bounded reproduction

`experiments/issue-246/contention-repro.sh` pins the build test to two cores
with `taskset` and runs it alone and inside `deno test --parallel --shard 1/3`,
for the matrix code before 5cc0d7c and for the current code.

| Code   | Run        | bundle modules | render chunks | render matrices | Test |
| ------ | ---------- | -------------: | ------------: | --------------: | ---: |
| before | standalone |        4479 ms |       6113 ms |         9830 ms | 26 s |
| before | shard 1/3  |        6829 ms |       7182 ms |        13370 ms | 35 s |
| after  | standalone |        5269 ms |       7497 ms |         7005 ms | 26 s |
| after  | shard 1/3  |        6406 ms |       6898 ms |         7511 ms | 31 s |

## Cancellation

Node and Deno abort `t.signal` when a test times out. Bun does not
(`experiments/issue-246/signal-probe.test.mjs`), so before this change a Bun
timeout left the Vite child running until it finished on its own.

The test now owns a 50 s deadline below the 60 s test timeout. The deadline
and `t.signal` both abort the `execFile` signal; the test then awaits the
child's `close` event and fails with `Vite build terminated: <reason>`.
`experiments/issue-246/cancel-check.sh 3000` shrinks the deadline to 3 s:

```text
== node --test
[site-build] abort: build exceeded 3000ms (at 3003ms)
[site-build] child exit (at 3054ms)
[site-build] child close (at 3054ms)
  Error: Vite build terminated: build exceeded 3000ms
no orphaned build
== deno test -A
[site-build] abort: build exceeded 3000ms (at 3003ms)
[site-build] child close (at 3071ms)
error: Error: Vite build terminated: build exceeded 3000ms
no orphaned build
== bun test --timeout 60000
[site-build] abort: build exceeded 3000ms (at 3005ms)
[site-build] child close (at 3065ms)
error: Vite build terminated: build exceeded 3000ms
no orphaned build
```

`experiments/issue-246/abort-close-probe.mjs` confirms that all three runtimes
deliver `exit` and `close` with `SIGTERM` after an `execFile` abort.

## Verification

```bash
node --test packages/site/tests/build-trace.test.js packages/site/tests/build.test.js
SITE_BUILD_TRACE=1 node --test packages/site/tests/build.test.js
deno test -A --parallel --shard 1/3
experiments/issue-246/cancel-check.sh 3000
npm test && npm run lint && npm run format:check && npm run check:duplication
```
