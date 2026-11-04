# Reproduce the independent draft autosave race

`packages/ui-components/tests/e2e/helpers/delay-token-autosave.mjs` widens the
second 500 ms timer in the editor tab
scenario to 2000 ms. It changes only the experiment's browser clock scheduling;
the production model and normal browser test keep their original timings.

The `reload restores both drafts when tokens autosave runs later` regression in
`packages/ui-components/tests/e2e/editor.spec.js` now applies this helper
automatically (#173). Run:

```sh
npx playwright test packages/ui-components/tests/e2e/editor.spec.js --project=webkit --grep 'tokens autosave runs later' --workers=1 --retries=0
```

With the document-only storage poll, reload loses the tokens draft and the dirty
tokens tab assertion fails. With both drafts polled, the same scenario waits for
tokens persistence and passes. The original `switching tabs` scenario continues
to use normal browser scheduling. This experiment deliberately delays a write;
it does not add a sleep or increase any assertion timeout in the regression.
