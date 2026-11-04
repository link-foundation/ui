# Issue 147: comments on the current UI

Source: [issue #147](https://github.com/link-foundation/ui/issues/147),
implemented in [PR #182](https://github.com/link-foundation/ui/pull/182).
The issue has no Dependencies section, comments or required sub-issues; the
initial PR has no conversation, inline comments or reviews (checked 2026-11-04).

## Requirements and work plan

1. Inventory the issue and existing selection, inspector, designer and export
   APIs. Reuse the existing page adapter and stable link IDs.
2. Write failing tests for per-object tasks, versioned LiNo round trips,
   validation, history and lasso geometry; implement the shared comment model.
3. Add object picking, freehand lasso, keyboard object selection, editable text
   and opt-in voice dictation; show comments beside their objects and in a
   panel. Persist, import and export LiNo; log annotation changes.
4. Expose the same comments workflow from dev mode (including foreign pages)
   and the designer. Document the format, APIs, policy and browser behavior.
5. Verify focused unit/browser tests and accessibility, capture review images,
   review the complete diff, merge current main, commit and run the four
   required commands on the candidate revision with bounded concurrency.
6. Push only the prepared branch, inspect every same-revision CI result and
   failure log, update the PR evidence and mark it ready once green.

| Requirement from the issue                           | Implementation and verification                                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Select individual UI objects                         | Shared adapter, pointer picking and keyboard checklist; `comments-ui.test.js` and browser text-task test                                                     |
| Select with a Photoshop-like lasso                   | Freehand polygon selection; geometry unit test and real-pointer lasso browser test                                                                           |
| Compose instructions with text or voice              | Editable text and opt-in speech; `comments-voice.test.js`, voice browser test including refusal                                                              |
| Create a separate subtask per object                 | Atomic deduplicated batches and independent edits; model and two-object browser tests                                                                        |
| Comments visible in the UI and readable by agents    | Anchored markers and nested LiNo; round-trip, documented example and light/dark axe browser tests                                                            |
| Describe changes to the current UI version           | Canonical snapshots and revision references; current/outdated/missing and anonymous-ID unit tests                                                            |
| Consistent, validated, tested, documented and logged | Shared inspector/designer/foreign workflow, strict reader, history, public declarations, format/API docs and changeset; required gates and CI recorded in PR |

## Interpretation

Object selection means selecting framework elements through stable link IDs,
not image segmentation. A lasso is a freehand closed polygon, distinct from
the designer's existing rectangular marquee. Voice dictation fills editable
text and requires an explicit user gesture; text remains available when the
browser has no recognition service. Comments are instructions, never executable
patches. Each task carries a revision reference to an exact LiNo snapshot so
an agent can detect outdated requests before applying edits. Comments remain
separate from the application document and its edit history.

## Verification record

The model and interaction tests were first run before their modules existed;
both failed with `ERR_MODULE_NOT_FOUND`. The implemented model passes 24 focused
unit tests (comments, voice, storage and designer), including a byte-exact check
of the specification's generated LiNo example. Seven browser tests pass with
one worker: text tasks and reload, lasso cancellation, voice opt-in/refusal,
light/dark WCAG 2.2 AA, designer and foreign-page persistence. The first audit
caught a marker whose accessible name omitted its visible instruction; including
the visible text fixed the violation in both color schemes. Two integration
regressions then reproduced stale indicators after direct store edits and lost
focus after closing a shadow-root panel. Subscribing to both adapter and store
changes, and restoring the deepest active element after showing the inspector,
fixed them.

Local pinned browser revisions were absent. The bounded
[`experiments/issue-147/playwright.config.mjs`](../../../experiments/issue-147/playwright.config.mjs)
reuses the already installed Chromium via `UI_DEVMODE_CHROMIUM_EXECUTABLE`.
CI runs the standard Chromium/WebKit matrix in its pinned Playwright image.
The foreign bundle was built with its existing workspace build script.
Required full checks and final CI results belong to the PR evidence for the
exact candidate revision; local command logs are retained in `dev/log/issue-147/`.

Before: [inspector](../../screenshots/ui-comments-before.png).
After: [light](../../screenshots/ui-comments.png) and
[dark](../../screenshots/ui-comments-dark.png).

No packages or third-party assets were added. The two changed publishable
packages have a minor changeset; release and merge are left to the maintainer.
