# Compact site client themes

[Issue #259](https://github.com/link-foundation/ui/issues/259) reports a
33 MB client module containing every theme's resolved token registry.

The site already compiles all theme CSS at build time. Page renders and
playground previews use `adoptStyles: false`; the preview links the same
stylesheet into its shadow root. Their runtime consumers need theme IDs,
comfort defaults and button templates. `packages/site/client-themes.js`
projects those fields, preserving diagnostics and the renderer's resolved
theme marker (`sets`). Token sets, modes, styles and inheritance chains stay
in the build process. This site-local projection must not compile CSS.

## Reproduction and timings

On Linux, Node 26.13.0, with no other builds running, both revisions used:

```bash
SITE_BUILD_TRACE=1 NODE_OPTIONS=--max-old-space-size=1024 node --test packages/site/tests/build.test.js
```

| Measurement            |           Before |        After |
| ---------------------- | ---------------: | -----------: |
| bundle modules         |          6490 ms |      2824 ms |
| render chunks          |          6532 ms |      1032 ms |
| render matrices        |          5822 ms |      5066 ms |
| write files            |           643 ms |       156 ms |
| main JavaScript bundle | 33,349,593 bytes | 20,125 bytes |

The before run fails the new 500,000-byte main bundle assertion. The after
run passes it and verifies all fourteen localized entries and gallery output
under the `/ui/` deployment base. Timings are individual observations, not
stable performance thresholds.

## Regression coverage

- `packages/site/tests/build.test.js` bounds the actual main bundle size.
- `packages/site/tests/client-themes.test.js` compares real rendered DOM
  using full themes and client themes for all 44 themes in light/dark modes,
  checks defaults and templates, exercises configuration switches and bounds
  metadata size.
- `tests/ui/site.e2e.mjs` switches every theme through the real site and
  playground controls, checks that precompiled CSS reaches both document
  and shadow root, and hydrates every localized route without script errors.
- Existing site and playground browser tests cover saved choices, language
  navigation, previews, gallery links, inspector edits and accessibility.

The repository's changeset guard requires a fragment even for the private
site package. Like the original site and build-tracing changes, this change
uses a `ui-core` patch fragment as the repository's release trigger.
