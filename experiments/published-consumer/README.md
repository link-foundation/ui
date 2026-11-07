# External package consumer

Issue [#209](https://github.com/link-foundation/ui/issues/209) requires real
versioned runtime archives that work outside this monorepo.

Run the production browser regression:

```bash
npm ci
npx playwright test tests/e2e/published-consumer.spec.js --project chromium --workers 1
```

The shared UI workflow also runs this test in WebKit. The test stages the real
Changesets release in a temporary directory, verifies every public package has a
version of at least 0.1.0 and compatible sibling ranges, and packs every package
with its normal lifecycle hooks. It checks all concrete exports, declaration and
CLI targets, README and LICENSE files, generated icon sets and their attribution
and license files, and the bundled network worker with its dependency licenses.

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

## Initial publication

The private root is tooling; install the individual packages from npm after the
first release, for example:

```bash
npm install @link-foundation/ui-react @link-foundation/ui-settings @link-foundation/ui-components react react-dom
```

Changesets versions every public runtime workspace in the first release and
updates internal dependency ranges; no manual package version edits are needed.
The publisher runs prepack in the monorepo to generate icons and the worker.
Consumer installation of the resulting archives runs no framework build scripts
and requires no monorepo checkout. Swift/Kotlin projects and private site and
extension workspaces are not npm runtime releases.

**Publication is still blocked:** at investigation time all 19 runtime packages
return npm 404, the repository has no Actions secrets, and main's release
preflight refuses publication. A maintainer must add a granular `NPM_TOKEN`
secret authorized to create the packages and authorize the first release. Then
configure each package's trusted publisher for `link-foundation/ui`, workflow
`release.yml`, and remove the bootstrap secret. Existing PR preflight reports
credential failures as advisory; main correctly fails with the required action.

Local tarball checks verify release contents and installation; they do not prove
npm publication. Keep that issue criterion open until all versioned packages are
visible in npm and a consumer installed from the registry archives passes the
same browser checks. The reporting site's code is neither copied nor relicensed.
