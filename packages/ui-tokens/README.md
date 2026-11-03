# @link-foundation/ui-tokens

Design tokens of the associative UI framework, written in Links Notation:
token sets that extend each other, aliases between tokens and modes such as
`dark`. The package reads them, resolves them, and writes them as CSS custom
properties, a [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/)
token file, SwiftUI constants and Jetpack Compose constants. It can also read
a DTCG file back as Links Notation, and it can hand the tokens to
[Style Dictionary](https://styledictionary.com) for other platforms.

The theme entry point also uses `@link-foundation/ui-style`. Style Dictionary
is an optional peer dependency, and it is loaded only by
`@link-foundation/ui-tokens/style-dictionary`.

```js
import { readTokens, resolveTokens, toCss } from '@link-foundation/ui-tokens';

const { sets, diagnostics } = readTokens(`
(material3: theme
  (extends base)
  (token color.primary '#6750A4')
  (token color.on-primary '#FFFFFF')
  (token space.medium 16px)
  (token shape.corner.medium 12px)
  (token motion.duration.short 150ms))
`);

const resolved = resolveTokens(sets, 'material3');
console.log(toCss(resolved));
// :root {
//   --color-primary: #6750a4;
//   --color-on-primary: #ffffff;
//   --space-medium: 16px;
//   --shape-corner-medium: 12px;
//   --motion-duration-short: 150ms;
// }
console.log(resolved.diagnostics.map((d) => d.code)); // ['unknown-set']: no base here
```

The complete example is `examples/ui-tokens-basics.mjs` in the repository.

## Grammar

A token set is a `theme` element with an id. It contains tokens, at most one
`extends` link and any number of modes:

```lino
brand: theme
  extends base
  token PATH VALUE
    type TYPE
    description 'text'
  token color.action
    token color.primary
  mode dark
    token color.primary '#D0BCFF'
```

| Link                          | Meaning                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `(token PATH VALUE ...)`      | A token. `PATH` is a set of names separated by dots (`color.on-primary`), without `{`, `}` or a leading `$`. |
| `(type TYPE)`                 | Optional. Without it, the type is taken from how the value is written (see below).                           |
| `(description 'text')`        | Optional. It is written as a CSS comment, `$description`, or a Swift or Kotlin doc comment.                  |
| `(token a (token b))`         | An alias: `a` has the value of `b`. With `(type T)`, the type of `b` must be `T`.                            |
| `(extends base other)`        | The tokens of `base`, then of `other`, then the set's own tokens; each one overrides the ones before it.     |
| `(mode NAME (token ...) ...)` | Tokens that replace the set's own tokens when the mode `NAME` is active.                                     |

Elements other than `theme` are ignored, so tokens can be kept in the same
file as a UI document.

### Types

| Type          | Written as                                                                                                   | Inferred from                         |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `color`       | `'#6750A4'`, `'#00000080'`, `(oklch 0.7 0.15 300)`, `(rgb ...)`, `(hsl ...)`                                 | the hex string or the colour function |
| `dimension`   | `16px`, `1rem`, `0`: only px and rem, as in DTCG 2025.10 section 8.2                                         | the unit                              |
| `duration`    | `150ms`, `0.2s`                                                                                              | the unit                              |
| `number`      | `0.38`, `1.5`                                                                                                | a plain number                        |
| `fontFamily`  | `Roboto 'Noto Sans' sans-serif`                                                                              | any other name or list of names       |
| `fontWeight`  | `400`, `bold`, `semi-bold` (the DTCG names)                                                                  | a weight name; numbers need the type  |
| `cubicBezier` | `(cubic-bezier 0.2 0 0 1)`                                                                                   | the head                              |
| `shadow`      | `(shadow (color ...) (offset-x 0px) (offset-y 1px) (blur 3px) (spread 0px) (inset true))`                    | the head                              |
| `typography`  | `(typography (font-family ...) (font-size 16px) (font-weight 400) (letter-spacing 0.5px) (line-height 1.5))` | the head                              |

A number such as `400` is read as a `number`, so a numeric font weight needs
`(type fontWeight)`. The field of a shadow or typography value can be an
alias: `(color (token color.scrim))`. A layered shadow lists its layers, and
each layer is a `(shadow ...)` or an alias to a shadow token:

```lino
token elevation.high
  token elevation.low
  shadow
    color '#0000004D'
    offset-x 0px
    offset-y 4px
    blur 8px
    spread 3px
```

## API

### `readTokens(text)`

Returns `{ sets, diagnostics }`. `sets` is a `Map` of set id to
`{ id, extends, tokens, modes }`. It never throws: syntax errors and bad
tokens are diagnostics (`syntax-error`, `anonymous-set`, `invalid-token`,
`invalid-mode`, `invalid-value`, `unknown-type`, `duplicate-token`), in the
shape of ui-core diagnostics: `{ code, severity, message, at }`.

### `resolveTokens(sets, setId, { mode })`

Returns a `Map` of path to `{ path, type, value, raw, alias?, description?, set, mode? }`
with the extra properties `setId`, `mode`, `modes` and `diagnostics`.

1. **extends**: the parent sets are taken depth first, in the order written,
   followed by the set itself. A later set overrides an earlier one.
2. **modes**: in each set of that chain, the tokens of the selected mode
   override that set's own tokens.
3. **aliases**: `(token a.b)` is replaced by the resolved value of `a.b`. This
   applies to a whole value, a composite field and a shadow layer. The token
   keeps `alias: 'a.b'`, so the writers can keep the reference.

`modes` maps every other mode of the chain to the tokens that resolve
differently in it, or exist only in it. The writers use it to output every
mode in one file.

| Diagnostic      | Severity | When                                                                      |
| --------------- | -------- | ------------------------------------------------------------------------- |
| `unknown-set`   | error    | `setId` does not exist (a warning when the missing set is a parent)       |
| `extends-cycle` | error    | `(a: theme (extends b))` `(b: theme (extends a))`                         |
| `unknown-mode`  | warning  | no set of the chain has the mode                                          |
| `unknown-alias` | error    | an alias names a token that does not exist                                |
| `alias-cycle`   | error    | `a -> b -> a`; `at.cycle` is `['b', 'a', 'b']` when it is reported on `b` |
| `type-mismatch` | error    | `(token a (token b) (type color))`, where `b` is a dimension              |

A token whose alias cannot be resolved is left out of the result.

### `toCss(resolved, options?)`

| Option         | Default                     | Meaning                                                                  |
| -------------- | --------------------------- | ------------------------------------------------------------------------ |
| `selector`     | `:root`                     | The rule that holds the tokens.                                          |
| `prefix`       | `''`                        | `md` gives `--md-color-primary`.                                         |
| `modeSelector` | `(m) => [data-mode="${m}"]` | The rule of a mode, with the tokens the mode changes.                    |
| `modeMedia`    | `{}`                        | `{ dark: '(prefers-color-scheme: dark)' }` puts a mode in a media query. |

Aliases stay `var(--color-primary)`, so a change to the target at run time
reaches its aliases. A typography token is written as one property per field
(`--type-body-font-size`), because CSS has no typography value.

### `toDtcg(resolved, { keepAliases = true })` and `fromDtcg(json, { id })`

`toDtcg` returns the object of a `.tokens.json` file. Every token has
`$type`, colours use the Color Module form (`{ colorSpace, components, alpha, hex }`),
dimensions and durations are `{ value, unit }`, and aliases stay
`"{color.primary}"` unless `keepAliases` is `false`. A token whose path is
also a group is written as the group's `$root`. DTCG 2025.10 has no modes, so
the tokens a mode changes go to
`$extensions["com.github.link-foundation.ui"].modes[mode]` (`DTCG_EXTENSION`).

`fromDtcg` reads a DTCG file (its text or its object) back as a Links
Notation token set. `fromDtcg(toDtcg(resolved))` gives the same tokens and
modes again. It also reads `{ "$ref": "#/a/b/$value" }` references, a group's
`$type`, and other colour spaces when they have a `hex` fallback. It throws a
`TypeError` naming the token for anything that has no Links Notation form.

### `toSwift(resolved, { name = 'Tokens' })`

A `public enum Tokens` of SwiftUI constants:

| Token         | Swift                                     |
| ------------- | ----------------------------------------- |
| `color`       | `Color(red:green:blue:opacity:)` (sRGB)   |
| `dimension`   | `CGFloat` points (1rem = 16)              |
| `duration`    | `TimeInterval` seconds                    |
| `number`      | `Double`                                  |
| `fontFamily`  | `[String]`                                |
| `fontWeight`  | `Font.Weight` (the nearest one)           |
| `cubicBezier` | `(x1:y1:x2:y2:)` tuple of `Double`        |
| `shadow`      | `Shadow` or `[Shadow]` (generated struct) |
| `typography`  | `Typography` (generated struct)           |

### `toKotlin(resolved, { packageName, name = 'Tokens' })`

An `object Tokens` of Jetpack Compose constants: `Color(0xAARRGGBB)`, `Dp`
(1rem = 16.dp), `const val ...Ms` milliseconds, `Float`, `List<String>`,
`FontWeight(n)`, `CubicBezierEasing`, and generated `Shadow` and `Typography`
data classes. An alias target is declared before its aliases, because an
object initialises its properties in order.

In both languages an alias is written as its target's constant, and each mode
is a nested namespace (`Tokens.Dark`) with the constants the mode changes.
Two tokens that would get the same constant name (`color.on-primary` and
`color.onPrimary`) cause a `TypeError`.

### `buildWithStyleDictionary(resolved, config, options?)`

From `@link-foundation/ui-tokens/style-dictionary`. It writes the tokens as
a temporary DTCG file, makes it the `source` of the Style Dictionary
`config`, builds all platforms and returns the Style Dictionary instance. Use
it for platforms this package does not write itself (SCSS, Android XML,
Flutter and so on):

```js
import { buildWithStyleDictionary } from '@link-foundation/ui-tokens/style-dictionary';

await buildWithStyleDictionary(resolveTokens(sets, 'brand', { mode: 'dark' }), {
  platforms: {
    scss: {
      transformGroup: 'scss',
      buildPath: 'out/',
      files: [{ destination: '_dark.scss', format: 'scss/variables' }],
    },
  },
});
```

Style Dictionary has no modes, so a build writes only the mode it was
resolved with. Install `style-dictionary` (version 4 or later) yourself;
otherwise the call fails with a message that says so. `options.StyleDictionary`
supplies the class, and `options.keepAliases` is passed on to `toDtcg`.

## CLI

```sh
link-ui-tokens build tokens.lino --set material3 \
  --css out/tokens.css --dtcg out/tokens.json \
  --swift out/Tokens.swift --kotlin out/Tokens.kt --package com.example.tokens
link-ui-tokens build tokens.lino --mode-media 'dark=(prefers-color-scheme: dark)'
link-ui-tokens import tokens.json --id material3 --out tokens.lino
```

`build` resolves one set and writes each output that is asked for. Without
any output, it prints the CSS. `--set` can be left out when the file has a
single set. `--mode`, `--prefix`, `--selector`, `--name` and
`--resolve-aliases` correspond to the options above. Diagnostics go to
stderr. The exit code is 1 when there is an error diagnostic and 2 for bad
usage.

## License

[Unlicense](LICENSE): public domain.

## Themes

`@link-foundation/ui-tokens/themes` exports `loadThemes`, `resolveTheme`,
`compileThemeCss`, `contrastRatio`, `ensureContrast`, `resolveTemplate`,
`themeBootScript` and `exportThemeResolver`. See the
[theme contract](../../docs/spec/themes.md) and
[base theme package](../ui-themes/README.md).
