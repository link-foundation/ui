# Live store / links verification

Issue: https://github.com/link-foundation/ui/issues/115

The regression tests first failed with `bindStoreLinks is not a function`.
The integration tests in `packages/ui-store/tests/bind-links.test.js` cover
concurrent edits, shared new strings, all store operations, local cache
updates, reconnect, server refusal rollback, undo isolation, disposal and
incremental writes. The links adapter tests retain legacy snapshot coverage.

Run the interactive example with `node examples/ui-store-live.mjs`, then
open its printed URL in two tabs. The normal Playwright configuration tests
it in Chromium and WebKit through `tests/ui/store-links.e2e.mjs`.

When the pinned browsers are unavailable but system Chrome is installed at
`/usr/bin/google-chrome`, this resource-limited local check runs one browser
and one worker:

```sh
npx playwright test --config experiments/issue-115/playwright.config.mjs
```

It verifies concurrent document edits, local undo, and an axe accessibility
audit. CI uses the repository's pinned browser container for both engines.
The screenshot in `docs/screenshots/issue-115/live-document.png` shows the
result after edits from two browser tabs.
