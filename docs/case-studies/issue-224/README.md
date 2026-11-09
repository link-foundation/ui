# Background layers (#224)

Original implementation from the issue's behavior specification. No consumer
code or shaders are copied. The #223 governor enhancement was merged into main during development and
is included in this branch. Layers use its elapsed-time resets and quality
shares, with local display cadence, still repaints and preference subscriptions.

Work plan and verification inventory:

- [x] Shared lifecycle: capped DPR, ResizeObserver and window resize, identical
      resize preservation, live updates, freeze/resume, visibility, preferences,
      quality shares, accessibility and print styles. Fake environment tests.
- [x] Seeded sprite starfield: all shapes, looks, motion, blend, count/area
      limits, sprite caching and stable positions. Drawing trace tests.
- [x] Shader backdrop: host source, typed uniforms, independent integrated
      clocks, failure cleanup, original nebula preset. Fake WebGL tests.
- [x] Grid beams: styles, direction reseeding, senses, snapping, randomized
      speed and pause. Drawing trace tests.
- [x] Glyph rain: painter/picker hooks, display-frame quantization, trails,
      alpha cleanup, static reduced-motion field and drift registration.
      Fake-clock and pixel tests, including 1000 fading steps.
- [x] CSS grid: all patterns, theme tint, radial fade and exact cell wrap.
      Style and registration tests.
- [x] Independent package exports and declarations; documented all-layer
      example; browser reduced-motion/no-WebGL checks and screenshot.

Verification commands:

- `node --test packages/ui-animation/tests/backgrounds/*.test.js`: 28 tests.
- `npx playwright test -c experiments/issue-224/playwright.config.mjs --workers=1`
  with local executable overrides: six Chromium/WebKit checks, including a real
  mounted rain layer driven through 1,000 simulation steps.
- `npm test`, `npm run lint`, `npm run format:check`,
  `npm run check:duplication`: required repository gates. The full test runner is
  CPU-affinity limited locally to keep process concurrency within the memory cap.

The changeset prepares the package release. Final gate output, current-revision
CI results and workflow completion are recorded in
[PR #239](https://github.com/link-foundation/ui/pull/239).

No required sub-issues or additional issue/PR feedback existed at initial audit.
Settings schema fragments are optional in #224 and are not introduced.
