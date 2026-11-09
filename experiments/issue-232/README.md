# Activity chart verification

[PR #248](https://github.com/link-foundation/ui/pull/248) implements the behavior
contract in [issue #232](https://github.com/link-foundation/ui/issues/232).
No consumer site source was used. The issue has no dependency blockers or
required sub-issues.

The initial seven focused regression cases failed against the original source:
log-scale parsing, calendar, composition, range and tag-cloud kinds, compact
stat-tile options, and bar options were unsupported. The completed focused suite
also covers invalid options, exact data preservation, monotonic tag sizes and
safe rich tooltip content.

```bash
node --test packages/ui-components/tests/charts/activity.test.js
node --test packages/ui-components/tests/charts/*.test.js
npx playwright test --config experiments/issue-232/playwright.config.mjs \
  packages/ui-components/tests/e2e/activity-charts.spec.js --workers 1
npm test -- --test-concurrency=1
npm run lint
npm run format:check
npm run check:duplication
```

The focused browser configuration uses the repository's Chromium and WebKit
projects. `ACTIVITY_CHROMIUM` optionally selects an already installed full Chrome
binary. Browser tests use one worker to limit memory. They check light/dark axe,
keyboard navigation, newest-week scrolling, tables, range-bar focus, compact
values and rich pointer/keyboard tooltips. The clipping regression switches the
same chart between inline and top-layer tooltips inside a clipped canvas,
verifies the tooltip extends beyond the clip, and saves before/after evidence.
The hidden calendar table must not extend the page with blank space.

The final Chromium gallery and clipping captures are checked in under
[`docs/screenshots/issue-232`](../../docs/screenshots/issue-232/).
The pull request records the final revision's required checks and CI results.

Ongoing ranges use an injected `ongoingEnd`, or deterministically the next year
after the latest supplied start/closed end. Calendar geometry uses UTC, and
navigation skips absent target dates by staying on the current supplied day.
Extended features use the SVG renderer in every host; the standalone ECharts
adapter reports unsupported extended specs explicitly. Existing chart fixtures
and SVG snapshots retain their original behavior.
