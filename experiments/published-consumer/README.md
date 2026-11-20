# External package consumer

Issue [#209](https://github.com/link-foundation/ui/issues/209) requires real
versioned runtime archives that work outside this monorepo.

Run the production browser regression:

```bash
npm ci
npx playwright test tests/e2e/published-consumer.spec.js --project chromium --workers 1
```

The shared UI workflow also runs this test in WebKit. The test stages the
workspaces in a temporary directory, applies pending changesets, verifies every
public package has a version of at least 0.1.0 and compatible sibling ranges, and
packs every package with its normal lifecycle hooks. It checks all concrete
exports, declaration and CLI targets, README and LICENSE files, generated icon
sets and their attribution and license files, and the bundled network worker
with its dependency licenses.

It installs those archives with `npm install --omit=dev --legacy-peer-deps` in a
standalone application. React, React DOM, Vue and Vite use versions from the
repository lockfile; optional peer integrations are not installed automatically.
The app has no monorepo aliases, source patches or links to development
dependencies. The staged release directory is removed before building. Vite is
the consumer's own installed build tool, not a framework runtime dependency.
The browser checks React rendering, settings defaults, packaged icons, both
asynchronous worker entry paths, the foreign inspector, accessibility, build
warnings, browser exceptions and failed HTTP responses.

For an interactive reproduction, run:

```bash
node experiments/published-consumer/build.mjs
```

Open the printed `/consumer/` preview URL. The command retains its temporary
archives, their integrity manifest and the installed consumer for inspection.
Stop the preview with Ctrl-C. To rebuild an existing generated consumer, pass its
printed temporary root as the first argument. The automated test cleans up its
own temporary directory.

## Verify published packages

Issue [#221](https://github.com/link-foundation/ui/issues/221) tracks the first
publication and verification of a consumer installed from npm. Run the same
build and browser checks against the published workspace versions:

```bash
UI_RELEASE_REGISTRY=1 npx playwright test tests/e2e/published-consumer.spec.js --project chromium --workers 1
```

Use a checkout whose public workspace versions have been published. This mode
installs exact versions of all public runtime workspaces from the public npm
registry into a fresh temporary application. It checks the consumer lockfile
for registry tarball URLs and integrity hashes for every dependency, including
transitive dependencies. It builds with the consumer's installed Vite and
uses the same browser assertions as the local archive test.

Run `UI_RELEASE_REGISTRY=1 node experiments/published-consumer/build.mjs` to
preview the registry consumer and inspect its generated `app/package-lock.json`.

## Install in your project

The private root is tooling. Install the runtime packages you need from npm.

```bash
npm install @link-foundation/ui-react @link-foundation/ui-settings @link-foundation/ui-components react react-dom
```

Changesets versions every public runtime workspace in the first release and
updates internal dependency ranges; no manual package version edits are needed.
The publisher runs prepack in the monorepo to generate icons and the worker.
Consumer installation of the resulting archives runs no framework build scripts
and requires no monorepo checkout. Swift/Kotlin projects and private site and
extension workspaces are not npm runtime releases.

The [follow-up release on main](https://github.com/link-foundation/ui/actions/runs/44676305074)
verified trusted publishing for all 19 runtime workspaces and published
`@link-foundation/ui-react-native@0.1.1` with npm provenance.
