# Issue 210 implementation and verification plan

The issue has no Dependencies section, comments or required sub-issues. PR 213
has no conversation comments, inline comments or reviews at the initial audit.
The consumer draft is evidence of contracts only: no unlicensed site code is
copied here.

Work in order, with regression coverage before each implementation batch:

1. Select: ignore disabled clicks, commit on Tab without trapping focus, move
   ten available options on Page keys, establish pointer focus, expose external
   trigger and distinct list naming, and suppress generated labels.
2. Popup: configurable minimum width and maximum height, viewport size bounds
   that update while open, and a portalled fixed-position fallback outside
   clipping ancestors. Verify real browser geometry at 390 × 320 and on resize.
3. Editors: live numeric input with draft preservation, nullable inherited
   values/fallback stepping/buttons, native text navigation; keyboard hex/RGB
   colors and named palettes. Verify input/change/store round trips.
4. Rich panel: declarative conditions, tabs, levels, groups and whole-section
   columns, preview/control/count hooks; saved looks and recoverable before-link
   state, comfort-safe sharing and constrained randomization. Test each hook
   independently and together with the existing engine.
5. Settings interoperability: explicit primitive/coercion and number snapping
   policies; compatibility codecs and before-paint reader hooks; changed-only
   application, removable inherited variables and resolved/derived tokens.
6. Document public APIs and examples, add package changesets, review the whole
   diff, run the four repository gates with bounded concurrency, push the exact
   checked revision, inspect every current-revision CI result, update and ready
   PR 213 only when all requirements and checks pass.

Verification evidence and final command results will be recorded here and in
PR 213. Existing defaults remain compatible unless the issue explicitly calls
for a behavior correction (select keys and number text-editing keys).

## Requirement evidence

| Requirement                                                                                                              | Implementation and verification                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Disabled click; Tab commit; Page keys skip disabled options                                                              | `controls/select-contract.test.js`; real Chromium/WebKit tests in `tests/e2e/control-contracts.spec.js`. All five new control/editor unit cases fail against the original implementation.                          |
| Configurable viewport-bounded popup, resize, clipped fallback and Safari focus                                           | Native and forced-fallback browser cases at 390 × 320, then resize to 300 × 260; geometry, explicit focus and cleanup assertions.                                                                                  |
| External/implicit labels; independent hidden list name                                                                   | Unit and browser tests query exact trigger/list names inside an enclosing label; hidden lists stay outside labels; axe checks.                                                                                     |
| Live numeric drafts, inherited null/fallback, pointer stepping and native navigation                                     | `controls/editor-contract.test.js`, updated number-field regression, browser input/draft/stepper case.                                                                                                             |
| Keyboard hex/RGB and named color palettes                                                                                | Unit editor contract and keyboard palette browser case.                                                                                                                                                            |
| Conditional fields, tabs, levels, groups, transparent previews, coupled fit limits, whole-section columns, custom counts | `settings/extensions.test.js` and rich-panel browser test; runnable `packages/ui-components/examples/rich-settings.html`. Preview lifecycle and custom editor disposal are asserted.                               |
| Named saved looks, recoverable Before the link, comfort-safe sharing                                                     | `settings/extensions.test.js`: snapshot before first successful share, restoration, named-look lifecycle and comfort preservation.                                                                                 |
| Copy/paste/file import/export and constrained randomization                                                              | Extension tests validate atomic rejection, export round trip and locked keys; existing settings action tests cover clipboard and file paths.                                                                       |
| Strict JSON primitives and continuous clamp policy; compatible LiNo                                                      | `ui-settings/tests/interop.test.js`: wrong primitives rejected, continuous values retained, null round trips, config binding and version migration. Existing permissive defaults retain their tests.               |
| Changed-only CSS, inherited removals, resolved/derived tokens                                                            | Interop tests count writes, remove null declarations and project derived values. Runtime and before-paint use the same projection hook.                                                                            |
| Existing storage key/object-codec compatibility before paint                                                             | Public codec/readStorage hooks validate decoded values; tests exercise a custom key and standalone before-paint reader. Hosts can supply the official object-codec/parser without a parallel normalization engine. |
| Public API and release                                                                                                   | [Integration contracts](contracts.md), package READMEs, public declarations, runnable examples and a changeset for all three changed published packages.                                                           |

The new browser contract suite passes all eight cases in Chromium and WebKit.
The existing control screenshot suite passes all eight cases after updating
baselines for the visible number step buttons. No consumer source or images
were copied. The following screenshots were generated from this repository's
own fixtures:

- [Original short-viewport popup](before-short-menu.png): top −130, height 330,
  leaving initial options outside the viewport.
- [Fixed popup](after-short-menu.png): top 8, height 173, width 280 inside the
  same 390 × 320 viewport.
- [Rich panel](rich-panel.png): whole-section columns and transparent frame preview.

Run the focused browser coverage with
`npx playwright test tests/e2e/control-contracts.spec.js --workers=1`.
The four repository gates and CI results are recorded in
[PR 213](https://github.com/link-foundation/ui/pull/213).
