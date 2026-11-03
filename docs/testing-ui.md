# UI testing: visual regression and accessibility

The repository has one shared [Playwright Test](https://playwright.dev/docs/test-snapshots)
setup with [axe-core](https://github.com/dequelabs/axe-core-npm). Every package
under `packages/*` and the demo site use it for two checks:

- **screenshot baselines** per browser (`chromium`, `webkit`), theme and locale;
- **a WCAG 2.2 A/AA audit** (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`,
  `wcag22aa`).

| File                                   | Purpose                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| `playwright.config.mjs`                | Projects, fixed viewport/locale/timezone, web server        |
| `scripts/serve-static.mjs`             | Static server for fixture pages and the example app         |
| `scripts/lib/static-server.mjs`        | Server code shared with `scripts/update-preview-images.mjs` |
| `scripts/check-playwright-version.mjs` | Keeps the npm pin and the container tags on one release     |
| `tests/ui/helpers.mjs`                 | `expectAccessible()` and `screenshotMatrix()`               |
| `tests/ui/*.e2e.mjs`                   | Smoke, negative (axe must catch violations), example app    |
| `.github/workflows/ui-tests.yml`       | CI in the pinned Playwright container                       |

## Running

```bash
npm ci
npm run example:web:build   # example-app.e2e.mjs audits examples/universal-app/dist
npm run test:ui:docker      # the same pinned image as CI: the authoritative run
npm run test:ui             # local browsers (npx playwright install); screenshots may differ
npx playwright test tests/ui/negative.e2e.mjs --project chromium
```

Test files end in `.e2e.mjs` so that `npm test` (`node --test`), `bun test`
and `deno test` never pick them up. Playwright discovers
`tests/ui/**/*.e2e.mjs`, `packages/*/e2e/**/*.e2e.mjs`,
`tests/e2e/**/*.spec.js` and `packages/*/tests/e2e/**/*.spec.js`. The
`tests/e2e` specs test packages together (for example
`interop-lottie.spec.js` plays a ui-convert export in lottie-web), and a
package's own specs test its gallery pages (for example
`packages/ui-components/tests/e2e/charts.spec.js` and `layout.spec.js`, which
opens `/packages/ui-components/examples/layout.html`); `bunfig.toml` keeps
them out of `bun test`, and `node --test` and `deno test` do not match
`.spec.js`.

The configuration fixes the viewport (1280×800, scale 1), `locale: 'en-US'`,
`timezoneId: 'UTC'`, `colorScheme: 'light'` and reduced motion. Screenshots
fail when more than 0.1 % of the pixels differ by more than the per-pixel
`threshold` of 0.05.

## Adding tests to a package

1. Create `packages/<name>/e2e/pages/` with static fixture pages. The server
   mounts them at `/packages/<name>/e2e/pages/`. It also serves every
   package's `src/` at `/packages/<name>/src/`, the `links-notation` dist
   and the issue-1 samples, so a page can load the packages with an import
   map and no bundler (see `examples/ui-dom/`).
2. Create `packages/<name>/e2e/<topic>.e2e.mjs`:

   ```js
   import { test } from '@playwright/test';
   import {
     expectAccessible,
     screenshotMatrix,
   } from '../../../tests/ui/helpers.mjs';

   test('button', async ({ page }) => {
     await page.goto('packages/<name>/e2e/pages/button.html');
     await expectAccessible(page);
     await screenshotMatrix(page, 'button', {
       apply: (p, { theme, locale }) =>
         p.evaluate((c) => window.setUi(c), { theme, locale }),
     });
   });
   ```

   `screenshotMatrix` writes `<name>-<locale>-<theme>.png` for every cell of
   `locales` (default `en`, `ru`) × `themes` (default `light`, `dark`); the
   `apply` callback switches the page to that cell.

3. Generate the baselines in the container (below) and commit them. They are
   stored next to the test:
   `packages/<name>/e2e/__screenshots__/<project>/<file>/<name>-<locale>-<theme>.png`
   (for this folder: `tests/ui/__screenshots__/…`; for a `.spec.js` file in
   `packages/<name>/tests/e2e/`:
   `packages/<name>/tests/e2e/__screenshots__/<project>/<file>/<name>.png`).

## Updating baselines

Only commit baselines produced by the pinned Linux container; fonts and
anti-aliasing differ on macOS, Windows and other Linux images.

- Locally: `npm run test:ui:docker -- --update-snapshots` — or run
  `docker run … sh -c 'npm ci && npx playwright test --update-snapshots'`.
- In CI: run the **UI tests** workflow manually (`workflow_dispatch`) with
  `update-snapshots` checked. It uploads the `ui-screenshots-<run id>`
  artifact with every `__screenshots__` folder. Download it, review the
  images and commit them. The job never pushes.

## Reading failures

When the job fails it uploads `ui-tests-failure-<run id>-<attempt>` with
`playwright-report/` and `test-results/`. For a screenshot mismatch,
`test-results/<test>/` holds `*-expected.png`, `*-actual.png` and
`*-diff.png`. Open `playwright-report/index.html` (or
`npx playwright show-report`) for the side-by-side view and traces.

## Accessibility policy and `knownViolations`

`expectAccessible(page, opts)` fails with a list of rule id, impact and target
selectors. Options: `include` (a selector), `exclude` (selectors), `tags`
(defaults to WCAG 2.2 A/AA) and `knownViolations`.

A violation is never ignored silently. If a page has a violation that cannot
be fixed in the same pull request, open an issue and add
`{ id: '<axe rule id>', issue: 'https://github.com/link-foundation/ui/issues/<n>' }`
to that test's `knownViolations` list. The helper fails when a listed rule
stops firing, so the list is cleaned up as soon as the issue is fixed.
`tests/ui/example-app.e2e.mjs` currently has no known violations.

`tests/ui/negative.e2e.mjs` proves that the audit works: axe must report
`label` and `color-contrast` on `tests/ui/pages/inaccessible.html`, and the
smoke test proves that one changed colour fails `toHaveScreenshot`.

## Version pinning

`@playwright/test` is pinned exactly and must equal the version of every
`mcr.microsoft.com/playwright@sha256:… # vX.Y.Z-noble` image in
`.github/workflows/*.yml` and of `playwright@X.Y.Z` installs.
`npm run check:playwright` (also the first step of `ui-tests.yml`) fails on a
mismatch. To bump: update `@playwright/test`, resolve the new digest with
`docker buildx imagetools inspect mcr.microsoft.com/playwright:vX.Y.Z-noble`,
update both workflows and the `test:ui:docker` script, then regenerate the
baselines.

## Licences

`@playwright/test` is Apache-2.0. `axe-core` and `@axe-core/playwright` are
**MPL-2.0**. They are allowed only as root devDependencies used by the tests
and CI: no published package may import them, bundle them or depend on
`tests/ui/helpers.mjs`. They are listed as reviewed exceptions in the
dependency review of `.github/workflows/security.yml`.
