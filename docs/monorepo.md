# Monorepo layout

The repository root is a **private** npm workspaces root. It holds the shared
tooling (release scripts, lint, format, CI) and is never published. Every
publishable artefact is a workspace package under `packages/`.

```
.
├── package.json            # "private": true, "workspaces": ["packages/*"]
├── package-lock.json       # one lock file for the whole workspace
├── packages/
│   ├── ui-components/      # @link-foundation/ui-components (behaviour state
│   │                       # machines, actions registry, a11y helpers,
│   │                       # link-view: one link as SVG or Canvas)
│   ├── ui-config/          # @link-foundation/ui-config (configuration layers)
│   ├── ui-convert/         # @link-foundation/ui-convert (HTML/DOM import)
│   ├── ui-dom/             # @link-foundation/ui-dom (DOM renderer)
│   ├── ui-i18n/            # @link-foundation/ui-i18n (localisation, lino-i18n)
│   ├── ui-kotlin/          # Jetpack Compose renderer: a Gradle Kotlin Multiplatform
│   │                       # project, not an npm workspace (no package.json)
│   ├── ui-links/           # @link-foundation/ui-links (associative links storages,
│   │                       # permissions, links server, synced client)
│   ├── ui-settings/        # @link-foundation/ui-settings (settings schemas)
│   ├── ui-style/           # @link-foundation/ui-style (style rules)
│   ├── ui-tokens/          # @link-foundation/ui-tokens (design tokens)
│   ├── ui-swift/           # SwiftUI renderer: a Swift package built from the
│   │                       # root Package.swift, not an npm workspace (no package.json)
│   └── ui-core/            # @link-foundation/ui-core
│       ├── package.json
│       ├── README.md
│       ├── LICENSE         # Unlicense
│       ├── src/index.js
│       └── tests/index.test.js
├── scripts/                # release tooling shared by all packages
│   └── workspace-packages.mjs
└── tests/                  # repository and release-script tests
```

`npm install` links every workspace into `node_modules/`, so package tests
import their package by name (`import { … } from '@link-foundation/ui-core'`)
exactly as a consumer would.

## Adding a package

1. Create `packages/<short-name>/` with `package.json`, `README.md`, `LICENSE`,
   `src/index.js` and `tests/index.test.js`. Copy `packages/ui-core` as the
   starting point.
2. In `package.json` set `"name": "@link-foundation/ui-<short-name>"`,
   `"version": "0.0.0"`, `"type": "module"`, an `exports` map,
   `"files": ["src/", "README.md", "LICENSE"]`,
   `"publishConfig": { "access": "public" }` and `repository.directory`.
   Add `"private": true` for internal packages that must never be published.
3. Run `npm install` to update `package-lock.json` and the workspace link.
4. Add a changeset for the new package (see below).

The root test script (`tests/*.test.js packages/*/tests/*.test.js
packages/*/tests/*/*.test.js`, so tests may be grouped one folder deep as in
`packages/ui-convert/tests/html/`),
`bunfig.toml`, `deno.json` and the ESLint test overrides already cover every
`packages/*` directory, so a new package needs no configuration changes.

## Naming

- Package names: `@link-foundation/ui-<short-name>`, directory
  `packages/<short-name>`.
- Release tags: `<package-name>@<version>`, for example
  `@link-foundation/ui-core@0.1.0` (see `scripts/release-naming.mjs`).

## Versioning

Each package is versioned independently. `.changeset/config.json` keeps
`fixed` and `linked` empty and uses `"updateInternalDependencies": "patch"`, so
a release bumps only the packages named in changesets plus their internal
dependents. The root `package.json` version is not released.

The release scripts discover packages through `scripts/workspace-packages.mjs`:

- `listWorkspacePackages(rootDir)`: every workspace package, sorted by name;
- `listPublishablePackages(rootDir)`: the packages without `"private": true`.

A root `package.json` without `workspaces` keeps the single-package behaviour
(the root itself is the release package). When several packages are
publishable, the changeset release handles all of them: the release check
looks at every package, merged changesets keep the bump of each package,
`changeset publish` publishes every package npm does not have yet, the smoke
test covers each of them, and the release job creates one GitHub release
`<name>@<version>` per package that has none yet. The manual release steps
(instant version bump, changeset PR) change one package, so they need
`RELEASE_PACKAGE=<package-name>`; the release workflow sets it from its
`package` input.

## Changesets

Name the workspace package in the changeset frontmatter:

```markdown
---
'@link-foundation/ui-core': patch
---

Describe the change for the package changelog.
```

`scripts/validate-changeset.mjs` rejects names that are not publishable
workspace packages. `npm run changeset:version` bumps only the named packages
and writes `packages/<short-name>/CHANGELOG.md`.
