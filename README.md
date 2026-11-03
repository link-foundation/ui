# link-foundation/ui

`@link-foundation/ui` is an associative UI framework whose documents,
configuration, styles and animations are written in
[Links Notation](https://github.com/link-foundation/links-notation).

The framework is at the planning stage: the package currently exports only its
`version`, and the features arrive through the roadmap issues.

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the target design.
- [docs/ROADMAP.md](docs/ROADMAP.md) — the roadmap issues in dependency order.
- [docs/native-parsers.md](docs/native-parsers.md) — the native Links Notation
  parsers (Swift) and the parser vectors they are checked against.
- [docs/case-studies/issue-1](docs/case-studies/issue-1/README.md) — the case
  study, requirements, solutions and research behind the plan.

The repository was created from the
[js-ai-driven-development-pipeline-template](https://github.com/link-foundation/js-ai-driven-development-pipeline-template),
which provides the CI/CD pipeline described below. The template's release
history is kept in
[docs/template-history/CHANGELOG.md](docs/template-history/CHANGELOG.md).

## Features

- **Multi-runtime support**: Works with Bun, Node.js, and Deno
- **Universal testing**: Uses [test-anywhere](https://github.com/link-foundation/test-anywhere) for cross-runtime tests
- **Automated releases**: Changesets-based versioning with GitHub Actions
- **Optional Docker Hub publishing**: Docker images can be published after the matching npm version is visible
- **Universal app example**: React UI for the package API with GitHub Pages, Electron, and Capacitor build paths
- **Code quality**: ESLint + Prettier with pre-commit hooks via Husky
- **Package manager agnostic**: Works with bun, npm, yarn, pnpm, and deno
- **Broken link checks**: Automated link validation with [lychee](https://github.com/lycheeverse/lychee-action) and Web Archive fallback suggestions

## Quick Start

The example app is deployed with GitHub Pages to
<https://link-foundation.github.io/ui/>. The site goes live after a maintainer
sets **Settings → Pages → Build and deployment → Source** to **GitHub Actions**
(see [#5](https://github.com/link-foundation/ui/issues/5)).

### Using the Package

```bash
npm install @link-foundation/ui
```

```js
import { version } from '@link-foundation/ui';

console.log(version);
```

### Importing HTML

[`@link-foundation/ui-convert`](packages/ui-convert/README.md) turns an HTML
string or a live DOM subtree into a UI dialect document:

```js
import { importHtml } from '@link-foundation/ui-convert';

console.log(importHtml('<button id="ok" class="primary">OK</button>').text);
// (ok: button
//   (label OK)
//   (attr class primary))
```

Scripts, `on*` attributes and `javascript:` URLs are dropped with a
`dropped-script` diagnostic; see the package README for the mapping table,
ids, spans and `importDom`.

### Interop with A2UI, Adaptive Cards, JSON Forms and Lottie

The same package converts both ways between the UI dialect and
[A2UI](https://a2ui.org), [Adaptive Cards](https://adaptivecards.io),
[JSON Forms](https://jsonforms.io) and [Lottie](https://lottie.github.io):

```bash
npx ui-convert import card.json > card.lino
npx ui-convert export card.lino --format adaptive-cards > card.json
```

See the
[capability matrix](packages/ui-convert/README.md#capability-matrix) for
what each format supports.

### Design tokens

[`@link-foundation/ui-tokens`](packages/ui-tokens/README.md) reads design
tokens written in Links Notation, with inheritance, aliases and modes, and
writes them as CSS custom properties, DTCG 2025.10 JSON, Swift and Kotlin:

```sh
npx link-ui-tokens build tokens.lino --set material3 \
  --css tokens.css --dtcg tokens.json --swift Tokens.swift --kotlin Tokens.kt
```

### Charts

[`@link-foundation/ui-components`](packages/ui-components/README.md)
renders charts written in Links Notation with `data`, `mark` and
`encoding` as deterministic, accessible SVG: `<ui-chart>` has a data table
twin and arrow-key navigation between points. ECharts is loaded only for
`(renderer echarts)`:

```html
<ui-chart>
  <script type="text/lino">
    (sales: chart
      (description 'Sales grew from 12 to 30 thousand')
      (data (row (month 2026-01) (value 12)) (row (month 2026-02) (value 30)))
      (mark bar)
      (encoding (x (field month) (type ordinal)) (y (field value) (type quantitative))))
  </script>
</ui-chart>
```

### DOM renderer

[`@link-foundation/ui-dom`](packages/ui-dom/README.md) renders a document as
plain custom elements in the light DOM (`ui-stack`, `ui-button`, …) with
stable `data-link-id` attributes, patches only what each store transaction
changed, and dispatches `(on press ...)` handlers as `ui-action` events
without running code:

```js
import { mountDocument } from '@link-foundation/ui-dom';

const { store } = mountDocument(app, text, { tokens, styles, onAction });
store.setProp('greeting', 'value', ['Hello again']); // one patch
```

### Behaviour and accessibility

[`@link-foundation/ui-components`](packages/ui-components/README.md) adds
behaviour written as LiNo state machines (`toggle`, `disclosure`), an actions
registry that never evaluates code, and keyboard and focus helpers:

```js
import { mountBehavior } from '@link-foundation/ui-components/behavior/dom';

mountBehavior(
  app,
  `(page: document
  (bold: button (label Bold) (machine toggle-machine)))`
);
// Enter, Space or a click switch aria-pressed on the button
```

### Link view

[`@link-foundation/ui-components`](packages/ui-components/README.md) draws one
link from Links Notation with `link-view`, using the links-visuals geometry.
The SVG and Canvas renderers share one set of marker shapes. Each element has
its own zoom and pan and asks for no animation frame while idle. The gallery
is `packages/ui-components/examples/link-view.html`:

```html
<link-view
  lino="(simple: link-view (link (id 1) (source 1) (target 2)) (markers (source bar) (target arrow)))"
></link-view>
```

### Layout and windowing

[`@link-foundation/ui-components/layout`](packages/ui-components/README.md#layout-and-windowing)
adds the layout kinds `stack`, `grid`, `split`, `tab-group`, `dock`, `window` and
`app-shell` to ui-dom, with a layer manager and dock layouts saved as Links
Notation:

```lino
(designer-shell: dock (persist designer.layout)
  (left: region (size 16rem) (panels toolbox outline))
  (right: region (size 20rem) (panels properties))
  (center: region (panels canvas))
  ...)
```

### SwiftUI

[`ui-swift`](packages/ui-swift/README.md) draws a LiNo document with native
SwiftUI views. Add this repository to SwiftPM and use the `UiSwiftUI` product:

```swift
UiView(document: UiDocumentModel(lino: text)) { action in
    // UiAction(source: "ok", event: "press", action: ["navigate", "home"])
}
```

### Jetpack Compose

[`ui-kotlin`](packages/ui-kotlin/README.md) draws a LiNo document with Material 3
Compose views (Compose Multiplatform desktop, optional Android). It is a
Gradle Kotlin Multiplatform project; `examples/kotlin` is a desktop window:

```kotlin
UiView(rememberUiDocumentState(text), onAction = { action ->
    // UiAction("ok", "press", listOf("navigate", "home"))
})
```

### Style rules

[`@link-foundation/ui-style`](packages/ui-style/README.md) reads style rules
written in Links Notation, with states such as `(state hover)` and conditions
such as `(media (max-width 640px))`. It writes them as a CSS stylesheet, or
resolves the style of one element against the design tokens for renderers
without CSS:

```js
import { compileCss, readStyles } from '@link-foundation/ui-style';

const { rules } = readStyles(`(button-style: style
  (selector (type button) (variant filled))
  (background (token color.primary))
  (state hover (elevation 2)))`);
compileCss(rules); // ui-button[variant='filled'] { ... } and ui-button[variant='filled']:hover { ... }
```

### Associative links, permissions and sync

[`@link-foundation/ui-links`](packages/ui-links/README.md) keeps links
(doublets) behind one storage interface: memory, SQLite, `doublets-web`, and
IndexedDB, `localStorage` or Links Notation text through persistence
adapters. It runs link-cli's substitution queries on any of them, keeps types
and permissions as links, and serves the `clink --serve` protocol. A synced
client keeps the part of the data a user may read and stays up to date:

```js
import {
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  linksToLino,
} from '@link-foundation/ui-links';

const server = createLinksServer({
  links: createMemoryLinks(),
  autoCreate: true,
});
const client = createSyncedLinks({ transport: connectInProcess(server) });
await client.query('() ((p: x y))');
linksToLino(client); // (1: 2 3)\n(2: 2 2)\n(3: 3 3)
```

### Development

```bash
# Install dependencies
bun install

# Run tests
bun test --timeout 30000

# Or with other runtimes:
npm test
deno test -A --parallel

# Lint code
bun run lint

# Format code
bun run format

# Check all (lint + format + file size)
bun run check

# Build the universal React example app
npm install --prefix examples/universal-app
npm run example:web:build
npm run example:desktop:package
```

## Project Structure

```
.
├── .changeset/           # Changeset configuration
├── .github/workflows/    # GitHub Actions CI/CD
├── .husky/               # Git hooks (pre-commit)
├── examples/             # Usage examples
│   ├── kotlin/           # Compose Desktop window for ui-kotlin (Gradle build)
│   ├── ui-dom/           # ui-dom page served with an import map (scripts/serve-static.mjs)
│   └── universal-app/    # React + GitHub Pages + Electron + Capacitor app
├── scripts/              # Build and release scripts
├── packages/             # npm workspaces (see docs/monorepo.md)
│   ├── ui-components/    # @link-foundation/ui-components (LiNo state machines, actions registry, a11y helpers, charts, diagrams with Dagre layout, SVG and Mermaid, layout and windowing, own CC0 icons, ui-icon, link-view)
│   ├── ui-config/        # @link-foundation/ui-config (layered configuration, overrides patches)
│   ├── ui-convert/       # @link-foundation/ui-convert (HTML/DOM, A2UI, Adaptive Cards, JSON Forms, Lottie <-> LiNo)
│   ├── ui-core/          # @link-foundation/ui-core
│   ├── ui-dom/           # @link-foundation/ui-dom (DOM renderer, plain custom elements)
│   ├── ui-i18n/          # @link-foundation/ui-i18n (localisation with lino-i18n, (t KEY) messages)
│   ├── ui-kotlin/        # Jetpack Compose renderer (Gradle Kotlin Multiplatform, see build.gradle.kts)
│   ├── ui-links/         # @link-foundation/ui-links (associative links storages, queries, permissions, links server, synced client)
│   ├── ui-settings/      # @link-foundation/ui-settings (settings schemas, presets, share links)
│   ├── ui-store/         # @link-foundation/ui-store
│   ├── ui-style/         # @link-foundation/ui-style (style rules, states, media and container conditions)
│   ├── ui-swift/         # SwiftUI renderer (Swift package, see Package.swift)
│   └── ui-tokens/        # @link-foundation/ui-tokens (design tokens)
├── tests/                # Repository and release-script tests
├── .eslintrc.js          # ESLint configuration
├── .prettierrc           # Prettier configuration
├── bunfig.toml           # Bun configuration
├── deno.json             # Deno configuration
└── package.json          # Private npm workspaces root
```

## Design Choices

### Multi-Runtime Support

This template is designed to work seamlessly with all major JavaScript runtimes:

- **Bun**: Primary runtime with highest performance, uses native test support (`bun test`)
- **Node.js**: Alternative runtime, uses built-in test runner (`node --test`)
- **Deno**: Secure runtime with built-in TypeScript support (`deno test`)

The [test-anywhere](https://github.com/link-foundation/test-anywhere) framework provides a unified testing API that works identically across all runtimes.

### Package Manager Agnostic

While `package.json` is the source of truth for dependencies, the template supports:

- **bun**: Primary choice, uses `bun.lockb`
- **npm**: Uses `package-lock.json`
- **yarn**: Uses `yarn.lock`
- **pnpm**: Uses `pnpm-lock.yaml`
- **deno**: Uses `deno.json` for configuration

Note: `package-lock.json` is not committed by default to allow any package manager.

### Universal App Example

The repository includes `examples/universal-app`, a Vite React app that imports
`UI_DIALECT_VERSION` from `@link-foundation/ui-core` (`packages/ui-core`) and renders it in a visual UI.
The same static build is used by:

- GitHub Pages (`npm run example:web:build`)
- Electron desktop packaging (`npm run example:desktop:package`)
- Capacitor Android/iOS sync (`npm run example:mobile:sync`)

The example app has its own `package.json` and lockfile so template users can
opt into the frontend stack without adding React, Electron, or Capacitor to the
library package itself.

See [examples/universal-app/README.md](examples/universal-app/README.md) for
local web, desktop, Android, and iOS testing instructions.

### Code Quality

- **ESLint**: Configured with recommended rules + Prettier integration
- **Prettier**: Consistent code formatting
- **Husky + lint-staged**: Pre-commit hooks ensure code quality
- **File size limit**: Files must stay under 1500 lines for maintainability (enforced via ESLint and CI)

### Release Workflow

The release workflow uses [Changesets](https://github.com/changesets/changesets) for version management:

1. **Creating a changeset**: Run `bun run changeset` to document changes
2. **PR validation**: CI checks for valid changeset in each PR
3. **Automated versioning**: Merging to `main` triggers version bump
4. **npm publishing**: Automated via OIDC trusted publishing (no tokens needed)
5. **Optional Docker Hub publishing**: When configured, waits for the exact npm version and tags the Docker image with that version
6. **GitHub releases**: Auto-created with formatted release notes

> **First release of a brand-new package**: OIDC trusted publishing cannot
> create a package that does not exist yet (the first publish fails with
> `E404`, because a trusted publisher can only be configured for an existing
> package). To bootstrap, add a repository secret named `NPM_TOKEN` (a
> granular/automation token with publish access). The release workflow passes
> it as `NODE_AUTH_TOKEN` automatically. Once the package exists and OIDC
> trusted publishing is configured on npmjs.com, the token becomes optional and
> can be removed.

#### Manual Releases

Two manual release modes are available via GitHub Actions:

- **Instant release**: Immediately bump version and publish
- **Changeset PR**: Create a PR with changeset for review

### CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/release.yml`) implements a fast-fail pipeline:

**Fast checks** (~7-30s each, run first for fastest feedback):

1. **Test compilation**: Syntax-checks all `.mjs` files with `node --check`
2. **Lint, format & secrets scan**: ESLint, Prettier, jscpd, and [secretlint](https://github.com/secretlint/secretlint) for credential leak detection
3. **File line limits**: Enforces the 1500-line limit on JavaScript (`.js`, `.mjs`, `.cjs`) and Markdown (`.md`) files plus `release.yml`
4. **Changeset check**: Validates PR has exactly one changeset (added by that PR)
5. **Version check**: Blocks manual version changes in `package.json`
6. **Documentation validation**: Checks required doc files (doc line limits are enforced by the file line limits check)

**Slow checks** (only run after all fast checks pass):

7. **Test matrix**: 3 runtimes × 3 OS = 9 test combinations
8. **Broken link checks**: Validates all links in Markdown/HTML files (separate workflow)

**Release** (on merge to main):

9. **Changeset merge**: Combines multiple pending changesets at release time
10. **Release**: Automated versioning and npm publishing
11. **Optional Docker publish**: Publishes Docker Hub `latest` and npm-version tags after the npm package is visible

#### Reasonable Timeouts

Every CI job declares an explicit `timeout-minutes` so hung steps fail
in minutes instead of reaching the GitHub Actions default of six hours.
Fast checks use 5-10 minute caps, release jobs use 50 minutes, and the
link checker uses 10 minutes for external network variance.

That cap is a backstop, never the deadline: GitHub reports a job it
kills as **cancelled**, not **failed**. Long steps therefore own an
explicit budget via `scripts/run-with-budget-warning.sh`, which warns at
70% of the budget and fails the step with exit code 124 when it expires.
See [CI-TIMEOUT-BUDGETS.md](docs/CI-TIMEOUT-BUDGETS.md).

Individual tests are also capped inside supported runners:
`npm test` runs `node --test --test-timeout=30000`, and the CI Bun
runner uses `bun test --timeout 30000`. Both bound a _single test_, not
the suite, which is why the suite budget above exists. Deno does not
provide a single global per-test timeout flag, so Deno tests are
protected by their step budget and the matrix job backstop.

See [BEST-PRACTICES.md](docs/BEST-PRACTICES.md) for detailed explanations of each practice.

#### Robust Changeset Handling

The CI/CD pipeline is designed to handle concurrent PRs gracefully:

- **PR Validation**: Only validates changesets **added by the current PR**, not pre-existing ones from other merged PRs. This prevents false failures when multiple PRs merge before a release cycle completes.

- **Release-time Merging**: If multiple changesets exist when releasing, they are automatically merged into a single changeset with:
  - The highest version bump type (major > minor > patch)
  - All descriptions preserved in chronological order

This design decouples PR validation from the need to pull changes from the default branch, reducing conflicts and ensuring that even if CI/CD fails, all unpublished changesets will still get published when the error is resolved.

### Deploying the example app

The `example-app.yml` workflow deploys the universal example app to GitHub
Pages on every push to `main`. Before the first run on `main` in a new
repository created from this template, open **Settings → Pages** and set
**Source = GitHub Actions**. This is a one-time manual step and cannot be
configured from a workflow because the Pages source defaults to
_Deploy from a branch_. Without it, the `pages-deploy` job fails on
`actions/deploy-pages` with `Get Pages site failed` /
`Failed to create deployment`. After flipping the source, the workflow
provisions the Pages site on its first run.

### Auto-regenerated preview screenshots

The same `example-app.yml` workflow contains a `preview-regen` job that boots
the built example app in a headless Chromium via
[`browser-commander`](https://www.npmjs.com/package/browser-commander) +
Playwright and writes fresh screenshots to
`docs/screenshots/example-app/example-app-{locale}-{theme}.png` on every
push to `main` (and on `workflow_dispatch`). Any drift is committed back to
`main` so README/site images never go stale between releases. Screenshot-only
pushes do not match this workflow's path filter, while a protected-branch
fallback PR remains eligible for its required checks. The job runs in the
official Playwright container with the browser already installed, avoiding CI
stalls from live Chromium downloads.

The same script is available locally:

```bash
npm install --prefix examples/universal-app
npm run example:web:preview-images
# Verbose probe of <html data-theme>, <html lang>, and PNG signatures:
PREVIEW_VERBOSE=1 npm run example:web:preview-images
```

The matrix defaults to `{en, ru} × {light, dark}`. The shipped example app
has no localization or theme toggle yet, so every cell currently renders
the same UI — when a fork adds either, the matrix produces real per-cell
variants without script edits.

### Broken Link Checker

The link checker workflow (`.github/workflows/links.yml`) validates all links in Markdown and HTML files:

1. **Detection**: Uses [lychee](https://github.com/lycheeverse/lychee-action) to scan all `*.md` and `*.html` files
2. **Web Archive fallback**: For any broken links found, automatically checks the [Wayback Machine](https://web.archive.org) for archived versions
3. **Actionable suggestions**: Reports one of three outcomes for each broken link:
   - **Archived**: Suggests the Web Archive URL as a replacement
   - **Not archived**: Clearly reports the link is unrecoverable
4. **Scheduled checks**: Runs weekly to catch links that break over time (even if no files changed)
5. **Issue creation**: On scheduled runs, creates a GitHub Issue with the full broken links report

Add regex patterns to `.lycheeignore` to exclude URLs from checks (e.g., local dev URLs, example.com, known rate-limited sites).

## Configuration

### Package Name

The root package is published as `@link-foundation/ui`. Release scripts derive
the package name from `package.json` at runtime, so no script-level
package-name constants need to be edited when it changes.

### Protected-Branch Release Pull Requests

If `main` requires pull requests and the `Pipeline Status` check, the release
and instant-release jobs can use their built-in `GITHUB_TOKEN` to open a release
PR. Enable **Allow GitHub Actions to create and approve pull requests** in
repository Actions settings. The helper verifies that the version commit is a
direct child of the validated workflow SHA and contains only package metadata
and consumed changesets. It then creates a successful `Pipeline Status` check
on that exact commit, linked to the validating run, waits for every required
check, and merges the PR only after they pass. The release jobs alone receive
`checks: write`. Set `RELEASE_METADATA_PATHS` to a comma-separated list of
additional exact metadata paths for other package layouts.

An optional `RELEASE_PR_TOKEN` secret keeps the existing dedicated-token path
and takes precedence when set. Give that actor Contents and Pull requests write
access and Checks read access. The manual changeset-PR and generated-preview
paths still require the dedicated token. A short-lived GitHub App installation
token can be wired to the same inputs instead of a PAT.

### Optional Docker Hub Publishing

Docker publishing is disabled by default. To enable it for a project that ships
a Docker image, add a `Dockerfile` and configure these GitHub Actions settings:

| Setting              | Type               | Description                                                                           |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `DOCKERHUB_IMAGE`    | Variable           | Docker Hub image name, for example `namespace/image`. This enables Docker publishing. |
| `DOCKERHUB_USERNAME` | Variable           | Docker Hub username used by `docker/login-action`.                                    |
| `DOCKERHUB_TOKEN`    | Secret             | Docker Hub access token used for registry authentication.                             |
| `DOCKER_CONTEXT`     | Variable, optional | Docker build context. Defaults to `.`.                                                |
| `DOCKERFILE`         | Variable, optional | Dockerfile path. Defaults to `./Dockerfile`.                                          |

When enabled, the release workflow waits until the exact published npm version
is visible in the npm registry, then publishes Docker Hub tags for `latest` and
that same version. The Docker build also receives `NPM_PACKAGE_VERSION` as a
build argument so Dockerfiles can install the matching published package.

### ESLint Rules

Customize ESLint in `eslint.config.js`. Current configuration:

- ES Modules support
- Prettier integration
- No console restrictions (common in CLI tools)
- Strict equality enforcement
- Async/await best practices
- **Strict unused variables rule**: No exceptions - all unused variables, arguments, and caught errors must be removed (no `_` prefix exceptions)

### Prettier Options

Configured in `.prettierrc`:

- Single quotes
- Semicolons
- 2-space indentation
- 80-character line width
- ES5 trailing commas
- LF line endings

## Scripts Reference

| Script                               | Description                                           |
| ------------------------------------ | ----------------------------------------------------- |
| `bun test --timeout 30000`           | Run tests with Bun and a 30s per-test cap             |
| `npm test`                           | Run tests with Node.js and a 30s per-test cap         |
| `bun run lint`                       | Check code with ESLint                                |
| `bun run lint:fix`                   | Fix ESLint issues automatically                       |
| `bun run format`                     | Format code with Prettier                             |
| `bun run format:check`               | Check formatting without changing files               |
| `bun run check`                      | Run all checks (lint + format)                        |
| `npm run example:web:dev`            | Start the universal app Vite dev server               |
| `npm run example:web:build`          | Build the universal app static web bundle             |
| `npm run example:web:preview-images` | Regenerate preview screenshots via browser-commander  |
| `npm run example:desktop:package`    | Package the Electron desktop app locally              |
| `npm run example:mobile:sync`        | Build and sync the app bundle into Capacitor projects |
| `bun run changeset`                  | Create a new changeset                                |

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed contribution guidelines.

Quick steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Create a changeset: `bun run changeset`
5. Commit your changes (pre-commit hooks will run automatically)
6. Push and create a Pull Request

## Best Practices

This template implements CI/CD best practices for AI-driven development. See [BEST-PRACTICES.md](docs/BEST-PRACTICES.md) for details on:

- File size limits for AI readability
- Automated formatting and linting
- Multi-runtime and cross-platform testing
- Changeset-based versioning
- Concurrency control for CI/CD pipelines

## License

[Unlicense](LICENSE) - Public Domain
