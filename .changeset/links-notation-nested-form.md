---
'@link-foundation/ui-core': minor
'@link-foundation/ui-components': minor
'@link-foundation/ui-convert': minor
'@link-foundation/ui-devmode': minor
'@link-foundation/ui-settings': minor
'@link-foundation/ui-store': minor
'@link-foundation/ui-tokens': minor
'@link-foundation/ui-animation': patch
'@link-foundation/ui-style': patch
---

Write Links Notation in the nested (indented) form by default, with as few parentheses as possible (#133). The one-line and parenthesized forms still read the same.

- ui-core: `format` and `formatLinks` default to `style: 'indented'`, and `formatLinks` also takes `links-notation` links. The new `parseNested`/`parseLinks` read the nested form back without path folding. `moveNode` can move the last lines of a nested element.
- The writers of the other packages now write the nested form:
  - dock layouts, charts, chart themes, diagrams and split sizes (ui-components)
  - the importers, rules and mappings (ui-convert)
  - the element source panel (ui-devmode)
  - values documents (ui-settings)
  - bundles and logs (ui-store)
  - DTCG import (ui-tokens)
  - the Swift and Kotlin `dumpLino` render trees

  The ui-settings share URL stays on one line.

- The `.lino` files, docs and examples are written in the nested form. `scripts/lino-nest.mjs` converts a file, `--check` lists the files that are not nested, and `--verbose` traces each group. `tests/lino-nested-form.test.js` keeps the repository nested.
- The GitHub issue templates are removed.
