# External Vite consumer regression

`build.mjs` packs the foreign inspector and its transitive UI dependencies,
extracts the npm tarballs into a temporary directory outside the workspace,
and builds a consumer with Vite 7 from ui-devmode's locked dev dependency.
Third-party JavaScript dependencies reuse the installed modules to avoid a
network install. The optional doublets-web peer is included only in the
installed-peer cases. There are no aliases or source transforms.

The consumer loads localization catalogs, imports live DOM and dynamically
opens the inspector. It is served at `/consumer/` to exercise deployment
paths. Run the emitted/inlined asset and installed/absent peer matrix in
the existing browser suite:

```sh
npx playwright test tests/e2e/vite-consumer.spec.js --project chromium --workers 1
```

The test checks the DOM outline, translated catalog content, agent template,
accessibility, browser errors, failed HTTP responses and build warnings.
Before the fix the build fails on the missing browser exports; after exposing
those exports alone, the inspector still fails because its assets resolve
beside the generated JavaScript without being emitted. With Vite's SPA fallback
that missing layout can return HTML and fail while creating the inspector.

Issue #215 also covers the optional doublets-web peer, both installed and
absent, for each asset mode. The installed case reuses the real locked peer
from the workspace and fails if it is missing. The consumer directly mounts
and updates a ui-dom document before opening the foreign inspector. It needs
no WASM plugin or store alias because neither operation uses the WASM backend.
