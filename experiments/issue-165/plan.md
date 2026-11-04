# Issue 165 implementation and verification

The issue has no Dependencies section, blockers, required sub-issues or comments.
PR 192 has no conversation comments, inline comments or reviews at intake.

1. Reproduce invalid HIG material CSS and add failing regression tests.
2. Reuse the existing selector and scope-root expressions for material rules.
3. Cover regular/thin/thick materials, native-part host and focus states,
   theme boundaries, custom tags, conditions and comfort fallbacks.
4. Add a ui-style patch changeset and capture browser before/after evidence.
5. Review the complete diff; commit; run the four required gates on that
   revision with bounded concurrency; push only issue-165-b918633889df.
6. Inspect all CI results for the pushed SHA, preserving failures in ci-logs;
   update PR 192 with acceptance evidence and mark ready only when green.

Acceptance mapping:

- Valid HIG selectors without boolean suffixes: HIG material compilation,
  esbuild CSS minification with zero syntax warnings, original reproduction.
- States, parts and theme boundaries: focused material selector unit tests
  and browser computed-style checks at material theme roots/nested boundaries.
- Regression: record focused failures before the source correction.
- Required checks: npm test, lint, format:check and check:duplication, then CI.

## Recorded focused evidence

- Before correction: the focused new material/HIG tests report 3 passed and
  7 failed. Browser regression fails at the regular root: expected blur(20px),
  received none. `docs/screenshots/issue-165/before.png` captures that state.
- After correction: 81 focused style, HIG and DOM style tests pass. All 6 HIG
  browser cases pass using installed Chrome and one worker, including the new
  root/nested-boundary regression and WCAG audit. The original reproduction
  returns an empty array. `docs/screenshots/issue-165/after.png` shows the fix.
- No new dependencies or third-party assets. The ui-style patch changeset is
  the repository's release trigger; package versions are changed by release CI.
- Full repository gates and final CI evidence are recorded in PR 192 after
  committing this candidate, so verification runs on the exact pushed revision.

## Cross-runtime CI follow-up

The first pushed revision (`3fc93c8`) failed Deno type checking on all three
operating systems: `TS2307: Import "esbuild" not a dependency` in the new
ui-style test. Logs are preserved under the ignored `ci-logs/` directory.
Keep selector comparisons in ui-style and move the HIG/minifier integration
test to `tests/material-css.test.js`, where esbuild is already declared as a
root development dependency. All eight focused tests pass in Node, Bun and
Deno after this test-only adjustment; no dependency changes are needed.
