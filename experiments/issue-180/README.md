# Windows Deno suite budget (#180)

## Requirements and verification plan

1. Preserve failing and successful logs and compare setup, test files and
   subprocess fixtures: the compressed logs below and `summarize-log.mjs`.
2. Identify accumulated cost with bounded tracing: historical timestamps and
   case durations below; `PREFLIGHT_FIXTURE_TRACE=1` records spawn, exit,
   stream-end and close elapsed milliseconds for each real preflight subprocess.
   Tracing defaults off and does not print credentials or response bodies.
3. Reduce elapsed time without dropping coverage or raising limits: use Deno's
   native `--shard` on three independent Windows runners, retaining the existing
   discovery config, `-A --parallel`, cold dependency setup and type checking
   inside each 300-second suite budget. Other Deno platforms use `1/1`.
4. Verify complete Windows coverage within budget on fresh CI runners, plus
   every Node/Bun/Deno platform combination: PR #198's current-revision runtime
   matrix. CI results and exact revision are recorded in the PR evidence table.
5. Verify all four repository gates on the pushed revision. Run local tests
   with two workers to fit the container's memory limit; CI retains its normal
   parallelism. No package behavior, test assertions or discovery exclusions
   are removed. The release-tooling changeset satisfies the repository guard.

There are no declared dependencies or required sub-issues on #180. Related
#178 concerns a separate intermittent Changesets timeout; its diagnostics and
repetitions remain intact. This change does not claim to diagnose that stall.

## Preserved evidence

- `windows-deno-failure.log.gz`: complete [job 126349617428](https://github.com/link-foundation/ui/actions/runs/41761186851/job/126349617428),
  the failure reported in #180, tested revision `4c414b9`.
- `windows-deno-success.log.gz`: complete [job 126341071283](https://github.com/link-foundation/ui/actions/runs/41757766574/job/126341071283),
  successful attempt 2 of the earlier run reported in #180.

These are different revisions, so the comparison characterizes accumulated
cost rather than claiming a controlled speed benchmark. The failure checks
392 files; the earlier success checks 391. Logs are retained byte for byte
inside deterministic gzip archives to reduce repository size.

```sh
node experiments/issue-180/summarize-log.mjs experiments/issue-180/windows-deno-failure.log.gz
node experiments/issue-180/summarize-log.mjs experiments/issue-180/windows-deno-success.log.gz
```

The analyzer reads one finite log in memory and starts no subprocesses. For
manual inspection, decompress to a temporary file and read chunks of at most
1,500 lines. Line references below are to decompressed logs.

| Observation                        | Failure                                    | Success                                        |
| ---------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| Suite start                        | line 278, 02:32:29.378                     | line 274, 02:08:45.063                         |
| Dependency download messages       | lines 279–1321, 02:32:30.797–34.941        | lines 275–1317, 02:08:46.483–51.486            |
| Dependency initialization messages | lines 1322–1815, 02:32:34.941–02:33:35.228 | lines 1318–1811, 02:08:51.486–02:09:48.775     |
| Check messages                     | lines 1823–2214, 02:33:49.082–49.133       | lines 1819–2209, 02:09:58.971–59.047           |
| First test result                  | line 2215, 02:33:51.872                    | line 2210, 02:10:00.230                        |
| First preflight result             | line 5483, 02:36:05.203                    | line 5465, 02:11:58.109                        |
| Last preflight result              | line 6162, 02:37:29.236 (incomplete)       | line 6158, 02:13:38.741 (complete)             |
| Suite end                          | line 6163, 02:37:30.347, terminated        | line 6162, 02:13:38.811, exit 0 at 293 seconds |

Download messages span only 4–5 seconds; dependency initialization spans
57–60 seconds. Checking/startup then adds another 11–17 seconds before the
first assertion result. These are observed message windows: the budget wrapper
batches output, so they are not exact profiler phase boundaries. Combined
startup costs 75–82 seconds, leaving only 218–225 seconds for tests.

The successful suite reports 218 seconds of test execution. Preflight starts
about 118 seconds after the first result and remains the final active file for
another 101 seconds. Summed rounded case durations identify preflight as the
largest file (91.262 seconds), followed by PR guards (52.615), change detection
(45.910), site build (22.013), and release API integrity (20.762). Most preflight
cases are real Bash/Node/curl-stub process trees; individual successful cases
cost seconds on Windows. Files overlap, so their durations must not be summed
into suite wall time. In the failure, preflight has already spent 76.598
reported seconds across 24 cases and continues passing at termination.

The dominant accumulated cost is cold dependency initialization followed by
process-heavy files and late scheduling of the longest fixture file. The
historical logs do not expose individual inner Bash/Node startup timings, so
no single syscall or child process is blamed. Independent native shards reduce
both the queued files before preflight and total work per runner without
replacing real fixtures. The new bounded process trace distinguishes future
process exit from delayed pipe close. Its 25-second process-tree guard uses
the existing shared helper, under Node/Bun's 30-second per-test guard.

## Regression and reproduction

`tests/deno-shards.test.js` fails against the original workflow because Windows
Deno has no partition. It verifies all three partitions, unchanged budgets,
and distinct concurrency groups. Its integration case uses the real Deno
runner and repository `deno.json` to discover root, package and nested test
files; across all three shards each sentinel must run exactly once. Excluded
files must stay excluded, and an assertion failure must fail its owning shard.
No test behavior is simulated. `tests/release-preflight.test.js` retains every
existing assertion and now bounds each real subprocess tree with `runBounded`.

```sh
node --test tests/deno-shards.test.js tests/release-preflight.test.js tests/visible-skips.test.js tests/ci-timeouts.test.js
deno test -A --parallel tests/deno-shards.test.js tests/release-preflight.test.js
```

The workflow reproduces the fix on fresh `windows-2025` runners using:

```sh
# Each shard runs on its own runner. Use 1/1 for an unpartitioned comparison.
DENO_SHARD=1/3
bash scripts/run-with-budget-warning.sh 300 "Deno test suite" deno test -A --parallel --shard "$DENO_SHARD"
```

No dependency install or checking phase has been moved outside the budget.
The 15-minute job backstop and all existing formatter probes are preserved.

## First fresh-run result and remaining subprocess stall

Revision `e8274de` ran all three shards in [run 41803933045](https://github.com/link-foundation/ui/actions/runs/41803933045).
The complete job logs are preserved as `windows-deno-shard-{1,2,3}.log.gz`.
Shards 1 and 2 finished their cold suites in 89 and 104 seconds. Shard 3
finished every preflight case by 09:05:21.455 (line 3967), but timed out at
09:07:51.137 (line 4065). Its last result was at 09:05:25.965 (line 4063).
The three preceding cases in `issue-262-regressions.test.js` completed at
09:04:21.710 (lines 2836–2868); its final case, `enforces LF for every
tracked shell script and hook`, never reported completion. Comparing the
union of shard results with the same-revision successful Linux Deno job
identifies that case as the only missing result. All other runtime legs and
all other workflows passed. This revision was not considered a completed fix.

That case performed 23 unbounded synchronous Git subprocess calls: one
`ls-files`, then `check-attr` for each of 22 tracked paths. The log localizes
the stall to this case, but cannot identify which individual invocation
stalled or prove an internal Deno/Windows cause. These are replaced with two
asynchronous `runBounded` calls with closed stdin: `ls-files -z`, then one
`check-attr -z eol --` covering every discovered path. NUL-delimited triples
retain path boundaries, and every `eol: lf` and file-content assertion stays.
Each command has half the existing fixture hang guard, keeping both calls
under the existing per-test budget. Optional `REPOSITORY_GIT_TRACE=1` records
arguments, spawn, exit, pipe end and close elapsed times; it defaults off.
Both lifecycle traces are enabled for Windows Deno CI so a recurrence names
the command and phase instead of consuming the entire suite budget silently.
