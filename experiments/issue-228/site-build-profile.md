# Site-build timeout investigation (#246)

PR #243's Windows Deno shard failed twice at the unchanged 60-second site
integration-test deadline. The complete second-attempt log is preserved locally
as `ci-logs/checks-42716746558.log`: lines 21717–21733 identify the timeout;
other Deno platforms and the dedicated site build passed. Main `c1016ba` is
already an ancestor of this branch.

A finite standalone Node run before the change completed the build test in
28.31 seconds. A CPU profile of the same site plugin showed 9.61 seconds under
`emitMatrices`, including 5.47 seconds in `parse`. For every language, example,
theme, scheme and state, the generator parsed the example, formatted the edited
document, then parsed that text again for rendering. This duplicated parsing is
proven by the profile and source; parallel Windows contention remains a
hypothesis until the new CI phase trace is collected.

The generator now parses each example once, clones its document per variant,
and renders that document directly. Share links still use the official LiNo
formatter. The focused Node site/matrix run passed all four tests, with the build
test at 22.94 seconds even while matrix validation ran concurrently. A standalone
Deno run passed both build tests in 21 seconds; its child exited at 18.62 seconds,
page generation took 1.79 seconds and matrix rendering 4.34 seconds. These local
timings are observations, not a substitute for Windows verification.

Reproduce the focused checks (each build is bounded by the existing test budget):

```bash
node --test packages/site/tests/matrix.test.js packages/site/tests/build.test.js
SITE_BUILD_TRACE=1 deno test -A packages/site/tests/build.test.js
```

For a CPU profile, invoke the package's resolved `vite/bin/vite.js` through
`node --max-old-space-size=640 --cpu-prof --cpu-prof-dir=/tmp/site-profile`,
using `build --config packages/site/vite.config.js --outDir /tmp/site-profile/output`.
Create `/tmp/site-profile` first. Profile only one build at a time. The initial
profile used the root Vite 6 build; the integration test resolves the site's
Vite 7. The measured repeated parsing is in the shared site plugin.

`SITE_BUILD_TRACE=1` enables page-generation, matrix-rendering and child
exit/close timings. It is enabled in Deno CI and silent by default. The test
also passes its cancellation signal to the child and awaits `close` before
removing its own output directory. No test deadline or content assertion was
relaxed, and every runtime still runs the build test.
