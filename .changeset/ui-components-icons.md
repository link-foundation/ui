---
'@link-foundation/ui-components': minor
---

New package `@link-foundation/ui-components` with icons and an asset pipeline:

- 32 public-domain (CC0-1.0) icons of our own, drawn on a 24×24 grid with a 2 px stroke in `currentColor`, each with a record in `assets/assets.lino`.
- An icon registry (`registerIconSet`, `resolveIcon`, `iconRecords`): a name falls back to the own set and then to a placeholder.
- The `ui-icon` element and the `icon` kind for ui-dom, `(icon close)` or `(icon (set lucide) (name check) (label 'Done'))`. An icon is decorative by default and becomes an image named by its label. Direction icons mirror in right-to-left text.
- Adapters for Lucide, Tabler and Material Symbols. These are optional peer dependencies, and every icon carries a licence record.
- `scripts/build-icons.mjs` builds each set into a module and a sprite with SVGO and `currentColor`, and writes `NOTICE.lino`, `ATTRIBUTION.md` and the licence files. The build fails on an icon without a record, on a licence that is not allowed, and on Remix Icon or SF Symbols.
