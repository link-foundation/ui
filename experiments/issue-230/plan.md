# Issue 230 work plan

- [x] Read issue, all comments, PR discussion/reviews, repository guidance.
- [x] Identify dependencies: #227 renderer (PR 242), #228 solver (PR 243),
      #229 configurations (PR 244) are open. No required sub-issues are listed.
- [x] Declarative LiNo schema: every specified renderer/solver option,
      validation, URL defaults/round trips, legacy aliases, availability.
- [x] Editor adapter: live notations, local errors/draft preservation, summary,
      link cards/remapping/actions, styles/resets/presets/storage, frame rules.
- [x] Solver adapter: busy/error/count state, apply only turns/gaps/frame.
- [x] Sharing: exact exports, synchronous clipboard activation, prepared Web
      Share, named downloads, target links, live announcements.
- [x] URL subscription: 400 ms debounce, held inputs, bounded backoff, cleanup.
- [x] Focused regression tests, browser/accessibility checks and screenshots.
- [ ] Full diff review and four required checks on committed revision.
- [ ] Push only prepared branch, inspect all CI results, update PR checklist.

Integration contract: accept the configurations module specified by #229 and
an asynchronous solver callback returning the #228 result. Do not implement
those other issues here or fake missing upstream behavior in tests. Record
integration tests as blocked if these APIs remain unavailable on main.

## Implemented scope and evidence

The issue permits adapter components for a prepared presentation. The public
editor now implements that boundary; it does not require a new default renderer
or collision algorithm, which belong to #227/#228. The actual pure #229 module
is reused from PR #244. Hosts pass their provider's option serializers and solver
callback; the example visibly disables Apply without one.

| Requirement                                                                | Evidence                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Schema, normalization, nondefaults, legacy gap, colours, all scalar bounds | network-editor-options.test.js                                 |
| Five live notations, invalid draft, localized alert, summary               | network-editor.test.js and browser suite                       |
| Cards, removal/remapping, counting across sizes, bounded inputs/actions    | network-editor.test.js; configurations.test.js                 |
| Presets, section resets, saved LiNo styles, availability                   | network-editor.test.js                                         |
| Pin retention for every colour and invalidation for geometry/count         | options/model and browser tests                                |
| Solver busy/errors/only three result fields/stale jobs                     | model tests with controlled callback results                   |
| Named exports, exact raster, JPEG matte, nested LiNo, clipboard activation | browser tests in Chromium and WebKit                           |
| Web Share preparation, stale files, URL fallback, share targets            | network-editor-share.test.js                                   |
| Held pointer/touch/key URL updates, backoff/disposal                       | network-editor-url.test.js and browser slider test             |
| Accessibility and screenshots                                              | browser axe audit and both notation baselines; docs screenshot |

Chromium and WebKit: 8/8 browser checks passed. Pinned browser archives were
verified and extracted manually after the Node 26 installer hung after download;
the Chromium test configuration used its explicit executable path. No caches
were removed. The first full npm run ignored a trailing concurrency flag and
approached the container memory cap; it was stopped. Final checks use CPU
affinity to constrain Node's default parallelism.

During final verification, #227 merged into main at c1016ba. Main is merged into
this branch, and createNetworkEditorProvider now binds all renderer options and
per-link colours to the actual built-in doublet provider. Its integration test
checks parsed options, explicit-marker defaults, pinned geometry and SVG colour.
The example and review screenshot use the actual doublet provider.

During final CI, #229 merged into main at 76cced8. Main is merged again,
retaining both the gallery and editor exports. Configuration sources match the
upstream implementation; the editor now uses the merged API directly.
