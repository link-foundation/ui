---
'@link-foundation/ui-convert': minor
---

Add the JSX / TSX and Vue single-file component importers: `importJsx(text, { mappings })` and `importVue(text, options)` turn React / MUI markup and Vue SFCs into `ui-dialect/0` Links Notation with spans, applied rule names and `{ code, message, span }` diagnostics for every unsupported construct. Components are mapped by a LiNo match / replace rule engine (`applyRules`, `readRules`) with built-in MUI rules (`src/mappings/mui.lino`); unmatched components fall back to `(html (tag X))`. Vue `v-if` / `v-else`, `v-for`, `@click`, `:prop` and `v-model` become `when`, `each`, actions and binds. The CLI gains `ui-convert import --from jsx|vue <file>` and `--mapping`.
