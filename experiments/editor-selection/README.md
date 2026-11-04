# Editor source replacement investigation (#197)

The failed [UI run 41791103437](https://github.com/link-foundation/ui/actions/runs/41791103437)
tested `c30ad9eefa7320f0498f1f3e29fbe6377faed973`. All 39 focused overlay tests
passed. The full suite failed the Chromium draft-restoration scenario on both
attempts: the tokens replacement was prepended to the original source.

## Evidence

The downloaded log reports the incorrect persisted text at lines 1178–1200 and
again at 1222–1243. The retained Chromium trace's `call@2373` fills the tokens
editor; its frame at 46937.163 ms already shows the concatenation and resulting
syntax error, before storage is checked. Persistence correctly stored an
unintended edit. Increasing the storage timeout would not repair it.

Playwright's `fill()` selects contenteditable text through a DOM Range before
inserting text. CodeMirror owns a separate selection state and can restore it
over that DOM selection. The bounded probe uses the public `focusEditor()` API
to force restoration synchronously between selection and insertion. This
reproduces the exact CI text. It controls the ordering, without claiming which
scheduled editor update ran in the original CI attempt.

## Reproduction and regression checks

Start `node scripts/serve-static.mjs --port 4173`, then run:

```sh
node experiments/editor-selection/probe.mjs
```

The probe opens two fresh browser contexts. With DOM-only selection, it asserts
that focus restoration collapses selection and insertion prepends to the original
source. With keyboard select-all, it asserts that restoration preserves the full
selection and insertion replaces the entire source. It saves `before.png` and
`after.png` from those controlled scenarios. The original trace has the same
visible concatenation as `before.png`.

The draft-restoration scenarios now focus the editor, select all using the
browser platform's modifier, and insert text. A new exact tokens-text assertion
catches an unintended edit before switching tabs. Both storage checks, undo/redo,
the delayed autosave scenario and post-reload assertions remain. The earlier
duplicate document-text poll was removed.

```sh
npx playwright test packages/ui-components/tests/e2e/editor.spec.js --grep 'switching tabs preserves|tokens autosave runs later' --repeat-each 5 --workers 1 --retries 0
```

The original unmodified Chromium scenarios passed all ten local repetitions;
the natural race remains intermittent. The assertion-based probe reproduces
selection loss deterministically and verifies the keyboard alternative. No
production code, screenshot baselines, assertion timeouts or retry counts change.

On 2026-11-04, with Playwright 1.59.1's Linux browsers, the repaired scenarios
passed **20/20** checks: five repetitions of both scenarios in each browser,
one worker, zero retries. The selection probe's assertions also passed.

Verification also requires the four repository checks on the exact pushed
revision and the full pinned UI workflow. PR #189 records those results and
links the retained focused overlay and full UI reports.
