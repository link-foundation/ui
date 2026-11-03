# Issue 58 implementation and verification

Dependencies #25, #54 and related #55 are closed; no required sub-issues or comments.

- [x] Foreign adapter: importer IDs, WeakMap reverse index, ignored inspector hosts,
      safe text/attribute/style writes recorded in session, 200 ms DOM refresh,
      stable selection, opaque shadow hosts.
- [x] Async per-origin/path localStorage and extension storage persistence;
      restore edits; LiNo overrides and selected subtree copy/export.
- [x] Shared inspector adapter integration preserving ui-dom behavior;
      bundled entry, toggle, fixed shadow host, configurable bookmarklet loader.
- [x] Private MV3 extension: toolbar injection, activeTab/scripting/storage,
      zip packaging and real unpacked Chromium verification under strict CSP.
- [x] Unit regression coverage, fixture and browser acceptance tests,
      accessibility and committed screenshot; README instructions and changesets.
      Verification finishes with a whole-diff review and the four required gates on
      exactly the committed revision that is pushed. CI results and the final acceptance
      inventory are recorded in https://github.com/link-foundation/ui/pull/151 before
      marking it ready; merging and deployment remain separate actions.

Local browser reproduction (reuse an installed Chromium with the optional
`UI_DEVMODE_CHROMIUM_EXECUTABLE` environment variable):

```bash
npm run build --workspace @link-foundation/ui-devmode-extension
npx playwright test packages/ui-devmode/e2e/foreign.e2e.mjs --config experiments/issue-58/playwright.config.mjs --workers=1
```

`UPDATE_DOCS_SCREENSHOTS=1` records the before/after and strict-CSP extension images.
The MV3 fixture uses a temporary host permission to simulate Chrome's real action
activeTab grant; the shipped manifest has no host permissions. The test dispatches
the actual registered background handler and injects the actual packaged file.

The real extension test reproduced ui-dom's null `customElements` crash (Bug #154).
`packages/ui-dom/tests/kinds.test.js` reproduces the same environment without a
browser; the null guard fixes it and preserves ordinary custom-element registration.
