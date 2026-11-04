# Descendant-cleanup observation race (#150)

## Plan and requirements

1. Preserve and compare the failing and passing Linux Deno job evidence.
2. Investigate observations before changing cleanup; reproduce the observer bug
   deterministically, then fix the observation without changing kill behavior.
3. Verify real descendant termination, zombies, reaping and PID reuse with the
   existing finite process, test and suite limits.
4. Run focused Node/Bun/Deno tests, the complete Linux Deno suite and the four
   repository checks. Review the whole PR diff and current-revision CI.

The issue has no Dependencies section, required sub-issues or comments; PR #177
had no conversation comments, inline comments or reviews when implementation
started. This change is confined to test infrastructure. A core patch changeset
satisfies the repository's code-change release guard, following existing shared
infrastructure changesets.

## Preserved CI evidence

- [Failing run](https://github.com/link-foundation/ui/actions/runs/41709268772),
  commit `f454a306bc26a585fc4c0dee6c4727f0a4f77ed5`, created
  2026-11-03 20:05:12 UTC: [job excerpts](failing-ci.txt). Linux Deno lines
  4207 and 5247–5259 show the two-second failure at the final liveness assertion,
  with 3,502 passed, one failed and one ignored.
- [Earlier run](https://github.com/link-foundation/ui/actions/runs/41707026716),
  commit `481dea6ba9f948ea1be6926b6f27628ee9d57640`, created
  2026-11-03 19:50:36 UTC: [job excerpts](passing-ci.txt). Linux Deno line 4110
  shows the same test passing in two seconds. The overall workflow failed in
  other jobs; this is evidence of the Linux Deno test passing only.

Full workflow and extracted Linux Deno logs were downloaded to
`/tmp/issue-150-evidence/`; excerpts retain the original job-log line numbers.
These historical logs contain no PID or process-state traces. They establish
that the polling condition returned false before a subsequent observation
returned true, but cannot establish which kernel transition caused that run.

## Investigation and regression

The old observer probes `kill(pid, 0)`, then reads `/proc/<pid>/stat`. A zombie
returns false. If a subsequent probe succeeds before reaping and the following
read fails with ENOENT, the catch returns true. This is a time-of-check/time-of-use
race: a reaped descendant appears to come back to life. PID reuse can also make
a fresh probe inspect an unrelated process.

`does not resurrect a zombie reaped between polling and assertion` injects this
exact sequence (successful probes, then Z and ENOENT reads). It first observes
false, then incorrectly observes true with the original function extracted from
Git. [Before-fix output](regression-before.txt) records the failed second
assertion. The fixed observer returns false for both observations. Injection
makes the regression deterministic without relying on scheduler timing or
claiming to reproduce the precise untraced historical event.

The bounded experiment `experiments/issue-150/observe-reaping.mjs` traces real
process exits with the original observation rules (20 children, at most 500 ms
of observations each, force-killed and awaited afterward). Run it with
`deno run --no-config --no-lock -A experiments/issue-150/observe-reaping.mjs`.
An initial 20-trial Linux Deno run saw zero conflicting observations; a passing
stress probe does not disprove the deterministic race.

## Result and verification map

Linux now reads state and start time from one proc record, treating ENOENT/ESRCH
as reaped and Z/X/x as terminated. Other read errors fail verification. Start time
is kept as a string and compared with the grandchild's self-reported identity,
so a new owner of its PID is distinct. Process group is recorded for diagnosis;
a group change alone does not mean the process has terminated. Other platforms
keep their signal probes, including EPERM meaning alive.

`BOUNDED_RUN_TRACE=1` enables JSON observations with expected identity, observed
PID/group/start time/state, diagnostic signal-probe result and the decision.
[Real Deno observations](trace-after.txt) show the running escaped descendant
and terminated descendants. Tracing is disabled by default.

| Requirement                                        | Automated evidence                                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic race regression                      | `does not resurrect a zombie reaped between polling and assertion`                                                                           |
| Live process, zombie, reaped process and PID reuse | Six tests in `tests/process-state.test.js`; includes unusual comm fields, changed groups, unexpected errors and portable signal probing      |
| Real tree kill and timeout reporting               | Existing `kills descendants on timeout and reports the timeout`, with grandchild self-reported identity and fresh final observation retained |
| Escaped descendant and finite pipe closure         | Existing `settles when a descendant escapes the kill and holds the pipes`                                                                    |
| Finite limits                                      | Unchanged 2 s timeout, 50 × 100 ms poll, 1 s escape timeout/500 ms pipe close; Node/Bun 30 s per-test guards and CI 300 s suite wrapper      |
| Runtime and repository validation                  | Focused Node/Bun/Deno commands and the four mandatory repository checks; full Linux Deno suite verified in CI on the pushed revision         |

No UI, dependency or published API changed.
