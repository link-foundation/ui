# WebKit editor draft restoration investigation

Issue [#173](https://github.com/link-foundation/ui/issues/173) records the same
missing dirty tokens tab as [#157](https://github.com/link-foundation/ui/issues/157).
There are no dependencies or required sub-issues. The two-draft persistence poll
was already merged in [PR #190](https://github.com/link-foundation/ui/pull/190).
This investigation retains an automated delayed-autosave regression alongside
the original browser scenario.

## Evidence and cause

The [original CI run](https://github.com/link-foundation/ui/actions/runs/41751331363)
at `e5d0ea076a95b4f26f088a5f8475fe207bf2faf7` reports:

- Log line 811: first WebKit attempt fails in 7.5 seconds.
- Line 814: retry succeeds in 3.1 seconds.
- Lines 957–978: `tokens.lino •` is missing after reload; the existing assertion
  times out after 5000 ms at `editor.spec.js:116`.
- Lines 990–993: one flaky test, 417 passed, 20 skipped.

`createDocumentsModel` schedules a separate 500 ms write for each edited draft.
Switching tabs saves the active tab metadata immediately, without flushing those
writes. The old test observed only the document draft before reload, so it could
cancel a pending tokens write. This is a test synchronization race; the evidence
does not establish a production persistence defect.

## Bounded verification

Use the repository's pinned Playwright image from `.github/workflows/ui-tests.yml`
with the checkout mounted at `/work`, dependencies installed, and working directory
`/work`. Run these commands in that container:

```sh
npx playwright test packages/ui-components/tests/e2e/editor.spec.js --project=webkit --grep 'switching tabs preserves' --repeat-each=5 --workers=1 --retries=0
npx playwright test packages/ui-components/tests/e2e/editor.spec.js --project=webkit --grep 'tokens autosave runs later' --repeat-each=5 --workers=1 --retries=0
```

The second scenario uses the helper retained from #157. It schedules the second
500 ms timer (the tokens draft) at 2000 ms, keeping the document timer and the
production model unchanged. Only browser scheduling in that test is modified.
Both scenarios use the same assertions for undo/redo, the restored selected tab,
and both restored draft contents. Neither increases timeouts or uses fixed sleeps.
The delayed scenario also runs in the normal Chromium/WebKit CI suite.

To test the regression's sensitivity, temporarily change the shared persistence
poll to compare only `restored.get('document.lino').text` against the document
draft, as it did before PR #190. Run the delayed scenario once with retries off;
the post-reload dirty tokens tab assertion must fail. Restore the two-draft poll
and rerun the same scenario. Keep that mutation out of commits.

The injected-clock model tests continue to verify the 500 ms debounce:

```sh
node --test packages/ui-components/tests/editor/documents-model.test.js
```

## Results

On 2026-11-04, using the pinned image
`sha256:b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53`:

- Document-only poll mutation: **1 failed**, with the exact missing
  `tokens.lino •` post-reload assertion and unchanged 5000 ms timeout.
- Restored two-draft poll: **10 passed (1.2m)**, five repetitions of each scenario
  under WebKit, one worker, retries disabled. The existing 30-second test budget
  and 5-second assertion budget were unchanged.
- Injected-clock model tests: **4 passed**.

No rendered UI changes or screenshot baseline updates are needed.
