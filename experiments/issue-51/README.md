# Classic themes work plan

Objective: implement and verify issue #51 in PR #160 without merging.
Dependencies #47, #36, #34 and #38 are closed; there are no required sub-issues
or issue/PR comments as of 2026-11-03.

1. Record source licences and provenance for each shipped pack.
2. Add deepcase themes, graph rules, landing tokens, classic chrome and handler windows.
3. Add independently implemented konard skins and all 35 frame variants.
4. Port all 12 immortality palettes and three requested presets, with reduced motion.
5. Add complete formal-ai skins and independent nested chat/composer themes.
6. Add meta-sovereign skins with contrast pairs and historical radii.
7. Register packs in the loader; render a layout-tab gallery and nested switching.
8. Verify parsing, coverage, all modes/pairs, frames, provenance, DOM preservation,
   accessibility and screenshot evidence. Run the four repository gates.
9. Review the complete diff, commit, push only the prepared branch, collect all
   same-revision CI results, update the PR acceptance table and mark ready if green.

Source research: repository case studies plus immortality revision
`16a6172c38fc120133485f805c49d980b9850bc4` settings.ts and styles.css.
Formal-ai and meta-sovereign LICENSE endpoints both report Unlicense.
The frame implementation uses the issue's description only.

To regenerate the token data, download the pinned upstream CSS (only data is
read), then pass its path. The palettes in settings.ts name the CSS palettes.

```sh
gh api repos/konard/immortality/contents/app/src/styles.css?ref=16a6172c38fc120133485f805c49d980b9850bc4 --jq .content | base64 -d > experiments/issue-51/immortality.css
node experiments/issue-51/create-packs.mjs experiments/issue-51/immortality.css
npx prettier --write packages/ui-themes/src/classic/catalog.js
```

The download is a local research input, not a required runtime asset. The preset
ports select palette/surface/frame and static effects; source animations and
sound are outside these theme packs. Poseidon uses a blue HUD, Arwes a cut frame
with 70% glass, and Quiet a plain solid panel. Full/reduced comfort combinations
are verified by compilation and browser computed styles.

Implemented requirements are mapped to the four `classic-*.test.js` files and
`tests/e2e/theme-classic.spec.js`. Focused theme/style tests and all three Chromium
checks pass after merging main. Screenshot evidence is in
`docs/screenshots/issue-51/` (38 packs, both historical comparisons, chrome,
windows, nested axes and all 35 frames). `update-frame-snapshots.mjs` regenerates
the frame fixture. Remaining release review uses the four repository gates and
same-revision CI, recorded in PR #160.
