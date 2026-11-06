# Issue 215 implementation and verification

Objective: fully implement issue #215 in PR #216 without changing the public
WASM adapter APIs. No dependencies section, required sub-issues, issue comments,
PR conversation comments, inline comments or reviews were present at initial
inspection. PR #214 supplies the existing external consumer fixture.

1. Extend the tarball consumer regression to include the installed optional
   doublets-web peer as well as its absence, both emitted and inline assets.
   Exercise mountDocument directly and open the foreign inspector. Capture
   the pre-fix WASM build error with the installed peer.
2. Extend the existing memory entry with GENERATED_ID_PREFIX and its declaration;
   move all three DOM runtime imports to that entry. Preserve the root exports
   and existing adapter tests. Add an API identity test and patch changeset.
3. Verify the four browser consumer cases, DOM/store tests and accessibility;
   save the final inspector screenshot. Run the required Node suite sequentially
   with a bounded heap, lint, format check and duplication check on the revision
   to push. Review the complete diff and confirm main is included.
4. Commit and push only issue-215-2c0097141a06. Collect every CI failure on that
   SHA before another push, preserve logs and correct any failures. Update PR
   #216 with reproduction, evidence for every criterion and screenshot; mark
   ready only after all checks pass. Do not merge.

Acceptance mapping:

- Installed-peer and absent-peer external production builds: four Playwright
  cases in tests/e2e/vite-consumer.spec.js with real UI npm tarballs, no aliases
  or WASM plugin; outline, mountDocument, localization, HTTP/browser errors and
  axe assertions.
- Public adapters preserved: unchanged root export and web-adapter tests;
  memory export identity regression.
- Regression proves original defect: run installed-peer case before the fix.
- Required checks: npm test, npm run lint, npm run format:check and
  npm run check:duplication; exact-revision CI as final cross-runtime coverage.

Validation results will be recorded in the PR description.

## Root cause and pre-fix evidence

The root store barrel re-exports the dynamic doublets-web adapter. Vite scans
that dynamic import even when the browser application only uses createStore.
The renderer's index.js, html.js and tree.js imported that barrel. The memory
entry previously exposed createStore and DEFAULT_ORIGIN, but not the generated
ID prefix used by tree.js.

Before changing the renderer, the installed-peer production probe failed:

```text
[vite:wasm-fallback] Could not load node_modules/doublets-web/doublets_web_bg.wasm
(imported by node_modules/doublets-web/doublets_web.js):
"ESM integration proposal for Wasm" is not supported currently.
```

The new memory identity test also failed before the change (`undefined !== '_'`).
After the change the same production probe builds with zero warnings; all 79
focused DOM, memory-entry and web-adapter tests pass, including the real WASM
adapter test under Node 26. No adapter implementation or root export changed.
This is a build failure, so there is no pre-fix rendered page to capture.
