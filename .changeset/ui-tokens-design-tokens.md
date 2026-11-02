---
'@link-foundation/ui-tokens': minor
---

Add `@link-foundation/ui-tokens`: design tokens written in Links Notation (`(token PATH VALUE (type T) (description '...'))`, aliases `(token a (token b))`, `(extends base)` and `(mode dark ...)`) for the DTCG 2025.10 types color, dimension, duration, number, fontFamily, fontWeight, cubicBezier, shadow and typography. `readTokens` and `resolveTokens` report problems as diagnostics (`unknown-alias`, `alias-cycle`, `type-mismatch`, ...). `toCss`, `toDtcg` (Color Module colours, modes in `$extensions`), `toSwift` and `toKotlin` write the tokens, `fromDtcg` reads a DTCG file back losslessly, and `@link-foundation/ui-tokens/style-dictionary` runs Style Dictionary, an optional peer dependency, for other platforms. The `link-ui-tokens build` CLI writes the CSS, DTCG, Swift and Kotlin files.
