# Links UI documentation site

Private workspace `@link-foundation/ui-site`. Every page and the shared layout
are Links Notation documents rendered by ui-dom. The Vite plugin emits an HTML
entry per route with a pre-rendered body; navigation and documentation work
without JavaScript. JavaScript mounts the same document for interactive controls
and dev mode (`?ui-dev` or Alt+Shift+D).

```sh
npm ci
npm run dev --workspace @link-foundation/ui-site
npm run build --workspace @link-foundation/ui-site
npm test --workspace @link-foundation/ui-site
npm run preview --workspace @link-foundation/ui-site
```

Open `/en/` or `/ru/`. The root redirects using `navigator.language`, defaulting
to English, and provides language links when JavaScript is disabled. The URL is
authoritative for the language. Shared layout labels use ui-i18n/lino-i18n;
content pages are translated in `content/<lang>/<page>.lino`.

The theme choices come from the registry: Base, Material 3, Fluent 2 and HIG (including
iOS and macOS variants). Light, dark and
system schemes use the theme engine. Choices persist as LiNo overrides in the
`user` configuration layer under `link-ui.site.user.v1`. If storage is disabled,
the controls still work for the current page. Explicit language links remain
available without JavaScript.

`linoPages({ contentDir, layout, languages: ['en', 'ru'] })` validates the page
sets, parses each source with ui-core and the site vocabulary, merges it into
`layout.lino`, localizes the layout and renders it with `renderToHTML`. Parser
errors include file, line and column. Generated Vite HTML inputs are confined
to the ignored `.lino-pages/` directory. Development edits reload the site. Site colors and spacing use
`src/styles.lino`; `src/site.css` adapts browser layout properties that the
current ui-style vocabulary does not expose.

For Pages builds, set `GITHUB_PAGES=true GITHUB_REPOSITORY=link-foundation/ui`.
Vite writes `/ui/` asset URLs, while navigation stays relative to the route.
`.github/workflows/site.yml` owns Pages deployment. The universal example keeps
its own build artifacts and desktop/mobile packaging.

The deployed URL is <https://link-foundation.github.io/ui/>. Publication of this
implementation requires a merge and successful main deployment. Neither merging
nor deployment is part of the PR validation.

Browser checks are in `tests/ui/site.e2e.mjs` and run in the existing Playwright
and axe workflow, which builds this workspace first. Screenshots are committed
under `docs/screenshots/site/` for review.

For a resource-saving local check with preinstalled Chrome:

```sh
npx playwright test tests/ui/site.e2e.mjs --config experiments/issue-62/playwright.config.mjs --workers=1
# With the static server running, regenerate the four review images:
SITE_CHROME_PATH=/opt/google/chrome/chrome node experiments/issue-62/screenshots.mjs
```

The components page includes all 19 catalog controls and 49 reusable story
examples from `content/examples/<component>/*.lino`. Each expandable example
shows its source and a lazy static frame containing every registered theme,
light/dark scheme and default/disabled state. Frames keep the complete gallery
usable on machines with limited memory. Each cell opens its exact document in
the playground. #20 exposes no forced hover/pressed API.

The playground uses the framework's resizable split, an accessible textarea with
line numbers, and an isolated preview. Updates debounce for 150 ms and keep the
last valid preview when parsing fails. Inspect opens ui-devmode on the preview;
property changes preserve source comments through ui-core/source. Examples and
preview theme/scheme selectors share the same source document.

Copy link uses `#lino=` or browser-native raw-deflate `#lino-z=` within an
8,192-character URL budget. Unsupported compression or oversized documents offer
copying the source instead. Shared text is limited to 65,536 characters and depth
32; known kinds and HTTPS/relative URLs are required. Actions become no-op log
calls; behavior machines and bindings are removed before rendering. No shared
document is sent to a server.

`tests/ui/playground.e2e.mjs` checks edits, invalid input, clipboard round trips,
inspector backsync, gallery links, axe and light/dark review images. Run it with
the same local Playwright config shown above. To regenerate the committed
examples from the controls' stories, run
`node experiments/issue-63/generate-examples.mjs`.
