# Issue 62 verification plan

Scope: the private bilingual LiNo documentation site and its single Pages
publisher. Dependencies #5, #24, #34 and #47 are closed; #21 and #54 are merged.
No required sub-issues or issue/PR feedback existed when work started.

| Requirement                                | Implementation                                   | Verification                                                         |
| ------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------- |
| Six pages in English and Russian           | `packages/site/content/{en,ru}`                  | `content.test.js` parses twelve pages and checks matching sets       |
| LiNo layout and documentation kinds        | `layout.lino`, `src/kinds.js`                    | Build test checks semantic headings and stable link IDs              |
| Prerendered multi-page build, diagnostics  | `linoPages`, `pages.js`                          | `build.test.js`, including malformed LiNo with source coordinates    |
| Language routes and internal links         | ui-i18n layout, translated content               | `links.test.js`, root locale and language navigation browser tests   |
| Content without JavaScript                 | Static ui-dom output and language links          | JavaScript-disabled browser test traverses English and Russian       |
| Registered themes, saved light/dark/system | Theme registry and user configuration layer      | Content registry assertion; browser reload and OS-change checks      |
| Dev mode                                   | `mountDevMode` and Vite runtime-asset adaptation | Production build browser test opens URL and shortcut entry points    |
| Accessibility and screenshots              | Shared Playwright/axe suite                      | Four locale/scheme audits and `docs/screenshots/site/*.png`          |
| Sole Pages publisher                       | `site.yml`; examples retain build artifacts      | Workflow tests and both workflow check scripts                       |
| Release preparation                        | Changeset consumed by existing release workflow  | Changeset validation in CI                                           |
| Repository gates                           | Existing npm scripts                             | Test, lint, format and duplication checks on the pushed revision     |
| Build test isolation across runtimes       | Child-process Vite build                         | Parent environment and kind registry unchanged; Node/Bun/Deno checks |
| Live documentation after merge             | Main-only Pages deployment                       | Pending merge/deploy; do not mark complete from the old live example |

Use one local browser worker and serial Node tests for the container budget.
The local browser config uses preinstalled Chrome; CI uses pinned Chromium and
WebKit. `screenshots.mjs` regenerates review images after building the site and
starting `node scripts/serve-static.mjs`.
