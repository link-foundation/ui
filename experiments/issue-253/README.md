# Windows/Deno formatter probe: nested npx startup

Issue: <https://github.com/link-foundation/ui/issues/253>
PR: <https://github.com/link-foundation/ui/pull/255>

## Requirements and verification plan

1. Identify the delayed operation in the nested `npx prettier` start with
   bounded tracing on Windows/Deno.
2. Add a regression for that cause while keeping the real Changesets
   `version` command and the real Prettier format check.
3. Pass the existing finite formatter repetitions without raising the 25 s
   `HANG_GUARD_MS`, adding retries or hiding failures.
4. `npm test`, `npm run lint`, `npm run format:check` and
   `npm run check:duplication` pass.

## Failures

- [Run 42728882567, shard 2/3](https://github.com/link-foundation/ui/actions/runs/42728882567/job/129545022401):
  `npx-cli.js` reads its npmrc files at its own +2.66 s. Its 20 s
  `activeHandles` timer fires only at +23.5 s. So the event loop was blocked
  for about 20 s by synchronous work between loading the configuration and
  spawning Prettier.
- [Run 42733947301, shard 1/3](https://github.com/link-foundation/ui/actions/runs/42733947301):
  npm logs `info ok`, but npx and its `cmd.exe` exit more than 9 s later.

Both failures come from the first formatter repetition after the Deno suite in
shards 1 and 2. The Deno job uses the runner's preinstalled Node 22.23.4 and
npm 10.9.9, and the suite never runs npm before it. So that repetition is the
first npm run on the VM. The later repetitions always passed.

## Bounded tracing added

`experiments/trace-changeset-fixture.cjs` (enabled only with
`DEBUG_CHANGESET_FIXTURE=1`) now reports these events:

- `slowRequire`: an outermost synchronous `require` of 1 s or more. Reported
  with CPU time, machine busy %, modules loaded, page faults and file-system
  reads (`process.resourceUsage()`).
- `eventLoopStall`: any timer gap of 1 s or more, including one just before
  exit.
- `slowSyncFs`: synchronous `open`/`write`/`close` calls of 1 s or more (npm
  writes its debug log this way).

`runner-snapshot.ps1` prints per-second machine and per-process CPU, paging
and C:/D: disk counters. The workflow runs it after the Deno suite and during
the first repetition.

## Findings (runs 42798633136, 42802768016, 42805630880)

The first npx run spends 1.7–4.0 s in one call, `require('./commands/exec.js')`:

```
slowRequire: {"request":"./commands/exec.js","ms":3989,"cpuMs":156,
  "machineBusyPercent":4,"modulesLoaded":484,"pageFaults":7273,"fsReads":1329}
```

That call loads 484 modules with 1,329 reads and about 7,200 page faults. Yet
it uses only 156–422 ms of CPU while the machine is 4–22% busy. The process
is waiting on disk. Over the same window the snapshot shows the C: OS disk at
90–100% disk time and 2–7 ms per read, with the D: work disk idle. Node and
npm live on C:. Later repetitions find these files in the OS cache, and their
Changesets run takes 0.7–1.5 s instead of 4.6–7.5 s.

Then npx exits slowly. npm 10.9.9's `lib/cli.js` calls
`module.enableCompileCache()`, whose directory is
`os.tmpdir()/node-compile-cache`, which is also on C:. On a cold run Node
writes the cache when the process exits. The snapshot shows this as a C:
write burst of 6–10 MB/s, and npx/`cmd.exe` exit 1.5–2.6 s after npm's last
log line. Failure 2's delay of more than 9 s is this same phase. npm also
writes a debug log to `C:\npm\cache\_logs`.

Both slow phases are synchronous disk work on the runner's system disk, and
only the first npm run on the VM hits them. When something else loads the
disk at the same moment, they grow from seconds to the 20 s seen in failure 1.

Local reproduction of the exit-time cache write, Linux, npm 10.9.9 (run
`node experiments/issue-253/count-npx-reads.cjs <npm>/bin/npx-cli.js`):

| case                   | total ms | after `exit` event ms | cache files |
| ---------------------- | -------: | --------------------: | ----------: |
| cold compile cache     |  850–905 |               115–131 |         552 |
| warm compile cache     |  590–686 |                 18–20 |           — |
| compile cache disabled |  650–680 |                 17–18 |           0 |

## Fix

The fixture's child environment now does three things:

- It sets `NODE_DISABLE_COMPILE_CACHE=1`, so no compile cache is written at
  exit.
- It sets `npm_config_logs_max=0`, so npm writes no debug log file. Verbose
  logging still goes to stderr and appears in the trace.
- It points `TMPDIR`/`TEMP`/`TMP` at a directory inside the fixture, so
  nothing the nested run writes ends up in the shared system temp directory.

Neither write is part of the release check. The real Changesets `version`
command and the real Prettier `--check` still run.

Regression check: after `changeset version`, the fixture asserts that its
temp directory is empty. Without `NODE_DISABLE_COMPILE_CACHE` the check
fails locally with `Expected ["node-compile-cache"] to equal []`.

## Remaining limit

The cold reads of npm's own 484 modules from C: are not removed. Changesets
always starts the formatter through `npx`, and the issue requires keeping
that path. On the traced runners those reads take 1.7–4 s, well under the
25 s guard, but they still depend on how busy the runner's system disk is.
