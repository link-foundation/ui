# Windows Bun suite budget investigation

Issue: [#149](https://github.com/link-foundation/ui/issues/149).

The suite kept passing tests until its 300-second step deadline. There was no
single hanging assertion. The failed runner accumulated process and filesystem
fixture costs while Bun ran test files serially. Another Windows runner passed
the complete suite in 218 seconds, confirming substantial runner variability.

## Preserved evidence

These gzip files contain the complete, unmodified GitHub job logs, including
runner setup and test output. Decompress them before using the line references.

- [Failing Windows Bun log](logs/failing-41703504774.log.gz):
  [run 41703504774, job 126157991893](https://github.com/link-foundation/ui/actions/runs/41703504774/job/126157991893),
  commit `85194c03f182e99e985ead63cff7aa9e492d68b8`, November 3, 2026.
  Lines 464–1231 cover suite execution; line 1222 reports the budget expiry,
  and line 1231 records exit 124.
- [Passing Windows Bun log](logs/passing-41756415408.log.gz):
  [run 41756415408, job 126334147978](https://github.com/link-foundation/ui/actions/runs/41756415408/job/126334147978),
  commit `aeb10edc67eb5b7adc74396d74c503e38ffe6bf0`, November 4, 2026.
  Lines 5784–5788 report 3,714 passes, 77 skips, zero failures and 218 seconds
  within the same 300-second budget. Both runners used Bun 1.4.4.

The comparison revision includes additional tests; these are observations from
separate runners, not a controlled benchmark of identical revisions.

## Attribution

Sum of Bun's reported individual test durations per file (seconds):

| File                                  | Failed run, partial suite | Passing run, complete suite |
| ------------------------------------- | ------------------------: | --------------------------: |
| `tests/detect-code-changes.test.js`   |                   118.485 |                      22.679 |
| `tests/pr-guards.test.js`             |                   112.574 |                      19.245 |
| `tests/lino-nested-form.test.js`      |                     9.374 |                       4.413 |
| `tests/changeset-config.test.js`      |                     8.130 |                       2.141 |
| `tests/release-api-integrity.test.js` |                incomplete |                      12.102 |
| `tests/release-preflight.test.js`     |               not reached |                      92.435 |

The two Git fixture files consumed 231.059 seconds, about 77% of the failed
suite's budget. Each case creates a fresh temporary repository and starts
multiple Git processes (`init`, identity configuration, add, commit, checkout,
merge) plus the actual CLI being tested. For example, the unchanged
`ignores experiments/repro.mjs changes on push` case took 2.133 seconds versus
0.415 seconds; `counts Dockerfile as code on push` took 2.309 versus 0.424.
The PR guard's invalid-JSON/missing-version fixture took 8.819 seconds
(failing log line 1130). These are integration fixture costs, not evidence
that any particular Git subcommand hangs. The preflight file also pays for
many Bash/Node/curl-stub processes on Windows (92.435 seconds in the passing
run). Timing only the files reached before failure would miss that later cost.

Reproduce attribution without running tests:

```bash
node experiments/issue-149/summarize-bun-log.mjs docs/case-studies/issue-149/logs/failing-41703504774.log.gz
node experiments/issue-149/summarize-bun-log.mjs docs/case-studies/issue-149/logs/passing-41756415408.log.gz
```

## Change and regression checks

Windows Bun uses three independent runners with Bun's built-in `--shard`
file partitioning and `--isolate` for fresh globals and module caches per file.
Every shard still has a 30-second per-test timeout, a
300-second step budget and a 15-minute job backstop. Shards use distinct
concurrency groups so they cannot cancel each other. The other eight
runtime/OS combinations retain their existing coverage. Bun on Linux and
macOS uses `--shard 1/1`, which runs every discovered file.

Independent runners isolate environment mutations and filesystem fixtures;
tests within each shard remain serial. Shard discovery sorts paths, exposing
a pre-existing file-order dependency: export-wrapper tests load Vue against
their jsdom document before ui-vue tests install a different document. Vue
caches its original document. A two-file replay failed four ui-vue assertions
without isolation and passed all 16 tests with isolation. Fresh globals and
module registries prevent that cross-file fixture leak without changing any
package implementation. No test is removed, mocked differently,
or given a longer timeout. Three shards bound the work per Windows runner
without introducing process contention on one machine.

`tests/bun-shards.test.js` guards the matrix, shard-specific concurrency and
all existing limits. Its workflow regression failed before the change. Its
real Bun fixture checks that root tests, package tests and nested package
tests execute exactly once across the three shards, archives and browser specs
stay excluded, globals and module state do not leak between files, and an
assertion failure fails its shard.

```bash
node --test tests/bun-shards.test.js tests/ci-timeouts.test.js tests/workflow-reliability.test.js
```

Reproduce the file-order failure, then add `--isolate` to make all 16 tests pass:

```bash
bun test --timeout 30000 --shard 1/1 ./packages/ui-convert/tests/export/wrappers.test.js ./packages/ui-vue/tests/components.test.js
```

Windows CI is the performance authority; passing local checks alone cannot
establish that the Windows suite meets its budget. Current-revision results
are recorded in [PR #176](https://github.com/link-foundation/ui/pull/176).
