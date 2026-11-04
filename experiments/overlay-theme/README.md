# Overlay theme investigation (#153)

Plan and verification inventory:

- Inspect the original failing trace and computed colors to identify the cause.
- Add a deterministic regression that fails before the fix.
- Synchronize theme application before axe, preserving both schemes and all
  WCAG 2.2 A/AA rules, without additional retries or known violations.
- Run all 12 overlay matrix cases three times under WebKit with one worker
  and zero retries in the pinned CI container.
- Run `npm test`, `npm run lint`, `npm run format:check`, and
  `npm run check:duplication` on the revision to push.
- Run the full UI workflow and retain its report on that revision; review
  the complete diff and all CI results before marking PR #189 ready.

The issue has no dependencies or required sub-issues. Its comments and all
three PR comment/review endpoints were empty when work began.

## Evidence and cause

The original run is
[41713264710](https://github.com/link-foundation/ui/actions/runs/41713264710).
Its retained `network-performance-41713264710-1` artifact contains
`packages-ui-components-e2e-f48d2--dark-screenshots-node-menu-webkit/trace.zip`.
The trace establishes a transient theme mismatch, rather than a settled palette
failure:

- `call@1314` requests dark media at trace time 131985.624 ms. Axe injection
  starts at 131990.728 ms, before a settled screenshot is requested.
- The frame at 132037.309 ms shows dark page text but still-light menu and tab
  surfaces. The frame at 132202.409 ms has the intended dark surfaces. The
  committed `before.jpg` and `settled.jpg` are these original trace frames.
- Axe's `call@1322` result reports seven failing labels: Editor, Insert, Delete,
  General, Advanced, Overview and History. Each has `#ffffff` foreground,
  `#7d7d7d` background and 4.11:1 contrast. The same result reports ordinary
  page text against `#1e1e1e` with 16.67:1 contrast.
- The retained overlay stylesheet already guards its background transitions
  with `prefers-reduced-motion: no-preference`. This is not evidence of an
  unguarded application CSS transition. The precise internal WebKit rendering
  mechanism is not established by the trace; the audit's sampling of an
  intermediate theme is visible directly.

The bounded `probe.mjs` samples computed surface/text colors and active
animations for 20 frames after each of three scheme changes. Run the static
server with `node scripts/serve-static.mjs --port 4173`, then
`node experiments/overlay-theme/probe.mjs` with Playwright 1.59.1's WebKit.
In the initial local probe (Ubuntu 24.04), settled dark colors were
`rgb(30, 30, 30)` / `rgb(255, 255, 255)`, the menu item transition duration was
zero (`transition: all`), and there were no document animations. This corroborates
the settled palette and explains why simply waiting for `document.getAnimations()`
would not establish readiness for the original failure. One passing probe does
not disprove the intermittent race: all 36 pre-fix local matrix cases passed.

## Fix and deterministic regression

`afterScreenshot` audits each cell only after Playwright's existing screenshot
assertion has finished finite animations and captured a stable matching image.
The overlay matrix uses this hook. There is no sleep, polling of axe results,
new known violation, contrast exception, retry increase or palette change.

The browser regression holds the actual radial-menu surfaces at the reported
`#7d7d7d` with a paused finite Web Animation. It verifies that axe detects the
transient dark-theme contrast failure, then checks both schemes through the
same screenshot/audit path and the unchanged existing baselines. Finally it
sets a permanent white-on-gray defect and proves `expectAccessible` rejects it.
The controlled animation stretches the observed transient state deterministically;
it does not claim to reproduce WebKit's internal implementation.

The animation has no fill, so finishing it releases the temporary gray override
and exposes the theme's own CSS background. Sampling an end color immediately
after `emulateMedia` can itself capture the previous scheme: the first full CI
run caught this in Chromium as white radial-menu backgrounds in the dark
screenshot. The regression therefore does not retain a sampled end color.

The permanent-defect control also disables transitions on its injected style
and captures it before auditing. Run 41787933994 exposed an early audit in this
control: axe measured white on `#6e6e6e` (5.09:1), before the injected background
reached `#7d7d7d` (4.11:1). All 36 ordinary matrix repetitions passed in that run.
The negative control must settle its own style change as well as the theme.

The helper callback regression fails against the old helper (neither theme is
audited). The original audit-before-screenshot order also fails on the controlled
transient color. Both checks ensure the test does not just rely on an isolated
passing natural-race run.
