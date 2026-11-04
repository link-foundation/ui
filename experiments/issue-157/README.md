# Reproduce the independent draft autosave race

`delay-token-autosave.mjs` widens the second 500 ms timer in the editor tab
scenario to 2000 ms. It changes only the experiment's browser clock scheduling;
the production model and normal browser test keep their original timings.

Temporarily import `delayTokenAutosave` into
`packages/ui-components/tests/e2e/editor.spec.js` and call
`await delayTokenAutosave(page)` before `start(page)` in the `switching tabs`
test. Run:

```sh
npx playwright test packages/ui-components/tests/e2e/editor.spec.js --project=webkit --grep 'switching tabs' --workers=1 --retries=0
```

With the document-only storage poll, reload loses the tokens draft and the dirty
tokens tab assertion fails. With both drafts polled, the same scenario waits for
tokens persistence and passes. Remove the temporary import and call before
running the normal ten repetitions. This experiment deliberately delays a write;
it does not add a sleep or increase any assertion timeout in the regression.
