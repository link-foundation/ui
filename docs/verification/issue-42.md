# Issue 42 verification plan

Scope: links-network model, six layouts, cancellable worker, label level of
detail, incremental store subscription, SVG/Canvas rendering, interactions,
exports and gallery. Dependencies #41, #16 and #40 are closed. No required
sub-issues or issue/PR feedback were present at the initial audit.

- [x] Model: points, link references (including cycles), self-loops, free ends;
      glyph and node-edge scenes use the markers and geometry from #41.
- [x] Circle, grid, hex, spiral, force and Dagre layered layouts are deterministic.
- [x] Force uses pinned d3-force, a fixed seed, alphaMin and at most 300 ticks;
      no animator frames remain after the result is drawn.
- [x] Worker jobs cancel by key, reject cancelled promises and ignore stale replies;
      disconnect terminates workers and unsubscribes from the store.
- [x] Labels hide below minZoom and greedy priority placement prevents overlap.
- [x] Store insert/update/remove/rename events preserve unaffected DOM elements;
      Playwright counts mutations for adding one link.
- [x] Click/Shift+click selection, point drag with pinning, neighbour hover,
      context menu hook, directional neighbour navigation, Enter activation,
      Escape deselection, keyboard zoom/pan, themes and reduced motion.
- [x] SVG through 2,000 links; Canvas for 5,000; actual panning exceeds 30 fps
      with a Playwright performance trace on CI.
- [x] SVG export is exactly the preview SVG; PNG export produces a Blob.
- [x] Gallery: 10/500/5,000 links; circle/hex/force, hidden labels and selected
      neighbours screenshots; real browser accessibility checks.
- [x] Changeset and public exports/types/docs. Final quality-gate results,
      revision review and CI links are recorded in
      [PR #139](https://github.com/link-foundation/ui/pull/139).

Tests are added before implementation and run to establish failure, then rerun
against the implementation. Local heavy checks run sequentially. Browser tests
run with one worker locally; CI provides cross-browser coverage.

Evidence is in `packages/ui-components/tests/links-view/network/{core,element}.test.js`
(18 cases), `packages/ui-components/tests/e2e/links-network.spec.js` (seven
browser scenarios), and `docs/screenshots/links-network/`. The Canvas scenario
records 60 animation frames during an active background drag, checks at least
50 actual draws and more than 30 fps, and attaches its timings and trace on CI.
The gallery screenshot includes circle, hex and force networks and 500 links
with hidden labels; the selection screenshot shows highlighted neighbours.

The initial repository test run hit two file deadlines under parallel load in
this memory-limited container. Verification uses Node 22 with one test process
at a time, preserving the repository's 30-second deadline and complete file
list. Browser verification uses the installed Chrome with one worker. CI runs
the supported runtime matrix and both Chromium and WebKit.
