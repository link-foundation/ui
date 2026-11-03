# Nested themes

From the repository root run:

```sh
node scripts/serve-static.mjs --port 4173
```

Open http://127.0.0.1:4173/examples/themes/. The four panels render the same
native controls with base light, dark, nested dark inside light (and light
again), and high contrast. A fifth panel follows the saved scheme or system
preference. Change **Saved scheme** and reload: the synchronous head script
restores it before the application module runs.

Theme data comes from `packages/ui-themes/themes/base/theme.lino`. Scheme
changes only change boundary attributes. The real button uses the theme's
icon, label and indicator template parts. Operating system dark, increased
contrast, reduced motion and forced color preferences are handled in CSS.

Run the browser checks and capture the four panels:

```sh
THEME_SCREENSHOTS=docs/screenshots/themes npx playwright test tests/e2e/themes.spec.js --project=chromium --workers=1
```

The test checks nested computed colors, preserved node identity, system
preferences, forced colors, synchronous saved preference restoration, and
axe accessibility (including contrast). See [the API contract](../../docs/spec/themes.md).

Open [classic.html](classic.html) for the five classic theme families, all 38
packs, the DeepCase chrome switcher, independent chat/composer axes and all
35 frame combinations. Historical reference images are compared beside the
recreated light and dark chrome in the browser evidence:

```sh
CLASSIC_SCREENSHOTS=docs/screenshots/issue-51 npx playwright test tests/e2e/theme-classic.spec.js --project=chromium --workers=1
```
