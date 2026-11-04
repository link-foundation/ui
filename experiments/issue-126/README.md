# Positional DOM updates (#126)

The original update routing treated positional events as named-property events.
Those events have `after` values but no `prop` or `props`, so the renderer kept
the old positional values and cleared its copy of the named properties.

Commit `ff5e9fc` (merged with #144) already fixed this on `main`: positional
events update the cached element with `after`, preserve its named properties,
and refresh the vocabulary's positional property names. This PR completes the
acceptance coverage without changing that implementation.

There are no blocking dependencies or required sub-issues in #126. The issue
and PR had no comments or reviews when implementation began.

| Requirement                         | Implementation and verification                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Positional text changes after flush | Existing `incremental.test.js` positional edit test; new `positional.e2e.mjs` browser test                                                            |
| Named properties remain rendered    | New incremental button test checks variant, disabled state, subsequent named update and press handler; browser test checks variant and disabled state |
| Undo restores old DOM text          | Existing incremental test plus new button and browser tests                                                                                           |
| Regression fails before fix         | `node experiments/issue-126/regression.mjs` temporarily restores the original event routing and asserts the tests fail; it always restores the source |
| Required quality checks             | `npm test`, `npm run lint`, `npm run format:check`, `npm run check:duplication`                                                                       |

Run the regression probe without concurrent tests or a server. Then verify:

```sh
node --test packages/ui-dom/tests/*.test.js
npm run test:ui -- packages/ui-dom/e2e/positional.e2e.mjs --workers=1
```

The browser test also checks WCAG accessibility. If the pinned Playwright
browsers are unavailable locally, the existing local configuration supports
`CHROME=/opt/google/chrome/chrome` with `--project=chromium`; CI uses the pinned
browser container.

The screenshots in `docs/screenshots/issue-126/` show the same document after
setting the greeting to `Hi` and the button label to `Save`. `before.png` uses
the original event routing, intercepted in the browser's module response;
`after.png` uses the current implementation. They show `Hello` / `OK` before
and `Hi` / `Save` after. No product styles were changed.
