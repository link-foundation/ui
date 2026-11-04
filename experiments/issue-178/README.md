# Windows/Deno release formatter investigation

Issue: <https://github.com/link-foundation/ui/issues/178>
PR: <https://github.com/link-foundation/ui/pull/194>

## Requirements and verification plan

1. Identify the subprocess, pipe, or contention cause with bounded tracing.
   Compare the full Windows/Deno parallel suite with isolated fixture runs;
   distinguish time before Node starts from time inside its subprocesses.
2. Add a regression for the identified cause. Keep the actual Changesets
   version command, package patch version assertion, unchanged private root,
   consumed changeset, changelog content, and real Prettier check.
3. Verify three finite Windows/Deno fixture repetitions and the full runtime
   matrix. Keep the 25-second command guard, process-tree kill, pipe-close
   fallback, and existing suite limits.
4. Run `npm test`, `npm run lint`, `npm run format:check`, and
   `npm run check:duplication`; review the whole PR diff and current-revision CI.

There are no declared blocker dependencies or required sub-issues. Issue #178
and PR #194 had no conversation comments, inline comments, or reviews at the
start of this investigation.

## Original evidence

The [original failing run](https://github.com/link-foundation/ui/actions/runs/41758326969/job/126340343000)
reports a 25-second timeout. In its complete workflow log, lines 41245–41279
contain the failure and trace. Changesets spawns the formatter shell at trace
+701 ms; Prettier reports 43 ms of formatting at +14366 ms; npm reports success
at +15254 ms. The trace stops without the shell's exit event.

Those timestamps start when the preload executes, while the guard starts
before spawning Node. They cannot establish a ten-second delay _after_ npm
success: some of that difference could be startup delay. The original trace
also does not record the nested npm/Prettier Node processes or stream closure.
Both a startup/contention hypothesis and a pipe-completion hypothesis remain
open until the shared-clock Windows trace is collected.

The optional `experiments/trace-changeset-fixture.cjs` preload now reports
fixture-relative startup time, process IDs, nested process entry/exit, child
exit/close, and stdout/stderr end events. The fixture inherits the preload
through `NODE_OPTIONS`, preserving existing options. It does not log environment
contents. Normal commands leave tracing disabled unless
`DEBUG_CHANGESET_FIXTURE` is set; the release fixture deliberately enables it
and prints it on a slow command or when explicitly requested.

## Reproduction

Run the actual fixture with full trace output:

```sh
DEBUG_CHANGESET_FIXTURE=1 deno test -A tests/changeset-config.test.js
```

CI also runs `deno test -A --parallel` and then three isolated Windows/Deno
fixture repetitions, each with its own finite outer bound. Local Linux Node
and Deno baselines pass in about two seconds, including all real version and
formatting assertions. These Linux results do not establish the Windows cause.

## Status

Diagnosis and the regression remain in progress. Passing isolated runs alone
will not count as satisfying the original issue's acceptance criteria.
