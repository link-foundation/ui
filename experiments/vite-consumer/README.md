# External Vite consumer regression

`build.mjs` packs the foreign inspector and its transitive UI dependencies,
extracts the npm tarballs into a temporary directory outside the workspace,
and builds a consumer with Vite 7 from ui-devmode's locked dev dependency.
Third-party JavaScript dependencies reuse the installed modules to avoid a
network install. Optional peers such as doublets-web are not installed in
this minimal consumer. There are no aliases or source transforms.

The consumer loads localization catalogs, imports live DOM and dynamically
opens the inspector. It is served at `/consumer/` to exercise deployment
paths. Run both emitted and inlined asset cases in the existing browser suite:

```sh
npx playwright test tests/e2e/vite-consumer.spec.js --project chromium --workers 1
```

The test checks the DOM outline, translated catalog content, agent template,
accessibility, browser errors, failed HTTP responses and build warnings.
Before the fix the build fails on the missing browser exports; after exposing
those exports alone, the inspector still fails because its assets resolve
beside the generated JavaScript without being emitted. With Vite's SPA fallback
that missing layout can return HTML and fail while creating the inspector.
