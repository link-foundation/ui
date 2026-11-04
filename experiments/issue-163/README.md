# LiNo network startup investigation (#163)

## Plan and acceptance evidence

- Read issue #163 and every comment, plus PR #191 conversation, inline comments
  and reviews. There are no dependency sections, required sub-issues or comments.
- Inspect the original failed trace and reproduce the startup lifecycle with a
  bounded test before changing code.
- Correct the confirmed duplicate source load; retain all existing layout,
  interaction, source failure and accessibility coverage.
- Verify the regression, then repeat the entire WebKit spec ten times with one
  worker and no retries; run all four required repository checks and check CI on
  the pushed SHA. Update PR #191 and mark ready only after CI passes.

## Evidence and cause

Original revision: `6b597963bfbde5796c2f01de23c39dedc6505623`.
[Original UI run](https://github.com/link-foundation/ui/actions/runs/41734601355),
artifact `network-performance-41734601355-1`, failed trace
`packages-ui-components-tes-7d255-al-workers-and-every-layout-webkit/trace.zip`.

The trace's `0-trace.network` records a successful worker response (200), then
`document.lino` fails with status -1 and
`_failureText: "WebKit encountered an internal error"`. At monotonic time
204791.943, `0-trace.trace` logs the same browser console error. The retained
error context shows `error: 1:1 Load failed` in Diagnostics. No links can appear
because `loadSource` catches that fetch rejection and clears the view. The old
helper polls for links until the test timeout instead of reporting diagnostics.

The deterministic application defect is the custom-element upgrade sequence:
`attributeChangedCallback('src')` runs with `isConnected === true` before
`connectedCallback`. Both call `#load()`. The second load immediately aborts the
first fetch and starts another for the same URL. Browser instrumentation on the
unmodified source confirms two fetch calls, with the first signal aborted.
The new unit regression also fails before the fix with `2 !== 1` fetches.
The trace does not expose WebKit's internal reason for failing that request;
the aborted replacement request sequence is the application-side trigger being
removed, rather than a claim to diagnose WebKit internals.

## Fix and verification

Track component connection initialization independently of DOM `isConnected`.
Ignore upgrade attribute reactions until `connectedCallback`, which already
forwards initial view attributes and starts the source load. Reset that state on
disconnect; retain cancellation of obsolete loads and loading on reconnect.
Optional `debug(message, data)` records source starts and failures, silently by
default. No sleeps, fetch retries, test retries or timeout increases are added.

`packages/ui-components/tests/links-view/lino-network-load.test.js` covers
connected markup upgrade with `src` and `lino`, later source changes,
disconnection, reconnection and stale response suppression. The browser
regression instruments actual `fetch` without mocking it and asserts exactly
one non-aborted initial request. The helper awaits registration and `ready`,
then checks diagnostics and nonempty links before the existing SVG assertion.

```sh
node --test packages/ui-components/tests/links-view/lino-network-load.test.js
npx playwright test packages/ui-components/tests/e2e/lino-network.spec.js --project=webkit --workers=1 --repeat-each=10 --retries=0
npm test -- --test-concurrency=2
npm run lint
npm run format:check
npm run check:duplication
```

`docs/screenshots/issue-163-before.jpeg` is the actual failed CI trace's last
screencast frame (800 × 500), showing the empty network and load diagnostic.
`docs/screenshots/issue-163-after.png` is a local browser capture after the fix,
showing the loaded example. These document startup, with no styling changes.
