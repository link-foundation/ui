# Issue 225 probes

These finite probes use one headless browser at a time and always close it.
Run from the repository root after installing development dependencies and the
pinned Playwright browsers:

- `node experiments/issue-225/probe.mjs`: inspect live CSS geometry and paint.
- `node experiments/issue-225/live-probe.mjs`: inspect inherited live controls.
- `node experiments/issue-225/parity-probe.mjs`: inspect CSS/SVG stroke paint at the smallest reference size.
- `node experiments/issue-225/pixel-probe.mjs`: inspect row and pixel differences after a Chromium reference screenshot failure.
- `node experiments/issue-225/trig.mjs`: compare container-unit arithmetic in
  Chromium and WebKit. WebKit miscalculates `tan(atan2())` with container units;
  the compiler uses length division and `hypot()` instead.
- `node examples/themes/responsive-frames/build.mjs`, then
  `node experiments/issue-225/capture.mjs`: regenerate the before/after evidence.

Set `FRAME_BROWSER` to the Chromium executable path when using a local browser.
`playwright.config.mjs` runs the regular browser suite with that executable;
normal CI uses the repository configuration and pinned Playwright image.
