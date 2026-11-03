# Theme packages and boundaries

Themes are named `theme` links, loaded by `loadThemes(text)` from
`@link-foundation/ui-tokens/themes`. They use the token grammar and resolver
of ui-tokens. `extends` lists parents in order; later parents and the child
win. Unknown parents, alias errors and inheritance cycles return diagnostics.

```lino
brand: theme
  extends base
  token color.primary '#3A5BA0'
  token color.on-primary '#FFFFFF'
  pair color.on-primary color.primary
  mode dark
    token color.primary '#AFC6FF'
    token color.on-primary '#0A2F6B'
  mode high-contrast
    token color.primary '#0B2A66'
  motion reduced
    token motion.duration.short 0ms
  template button
    part root
      kind box
    part label
      kind text
```

`resolveTheme(registry, id)` merges tokens, modes, styles, templates, pairs
and comfort defaults using that same inheritance order. `style` links use
ui-style's selector, state and media grammar. Theme content is data: a
`script` link or any value containing `javascript:` or `expression(` is
rejected with a diagnostic, including inside templates and styles.

`compileThemeCss(theme, options)` emits custom properties for light/dark,
normal/more contrast and full/reduced motion, including their system media
queries. Simultaneous modes apply in scheme, contrast, motion order, and
aliases resolve after the overrides. Every declared pair is checked in every
combination. Failing fills move in OKLCH lightness to reach 4.5:1 by default.
A non-text UI pair can declare `(pair color.outline color.surface (min 3))`;
the explicit minimum overrides the compilation default. Adjustment emits `contrast-adjusted` (warning, or error with `strict: true`).
An unreachable target emits an error. Collect diagnostics with
`{ diagnostics: [] }` or `onDiagnostic`; strict mode reports rather than throws.
Forced colors map semantic tokens to system colors. A theme can add inherited
`(forced-color token.path CanvasText)` rows for namespaced aliases. Values are
restricted to Canvas, CanvasText, Highlight, HighlightText, GrayText, ButtonText
and ButtonFace. Theme styles stay inside an
`@scope` boundary that stops at nested themes. Root selectors also match a
control or ancestor at the scope boundary. CSS nesting scopes require a browser supporting `@scope`.

Any UI element may carry `theme`, `scheme`, `contrast` or `motion` properties:

```lino
app: document
  theme base
  scheme light
  inset: stack
    scheme dark
    light-again: stack
      scheme light
```

A boundary writes all four effective `data-*` attributes. Scheme accepts
`light`, `dark`, `system`; contrast accepts `normal`, `more`, `system`; motion
accepts `full`, `reduced`, `system`. Missing choices copy the nearest boundary,
including surrounding DOM boundaries and boot attributes on `html`. Complete
mode declarations reset inherited dark values at nested light boundaries.
Changing store properties updates attributes without replacing controls or
part trees. Templates are selected at mount time; a live theme switch changes
the appearance of the existing parts.

Pass `{ themes, config }` to ui-dom. Comfort keys `motion`, `sound`, `volume`
and `transparency` resolve from configuration layers; user/session choices
outrank nested theme defaults. They appear as effective `data-*` attributes.
A scalar comfort link in a theme supplies a default. A `motion reduced` block
supplies reduced-mode tokens without selecting reduced motion by itself.

`resolveTemplate(themeChain, kind)` returns the last applicable template or
`null`. Button templates require `root` and `label`, and may contain `icon`
and `indicator`. Other controls can describe their existing `input`, `track`
and `thumb` anatomy. Parts have `kind box`, `text` or `icon`; unknown/duplicate
parts produce diagnostics. The native button keeps its keyboard, focus,
label and event semantics while its visual children follow the template.

Insert `themeBootScript({ storageKey: 'ui-theme' })` inline in the document
head before styles. Its UTF-8 output is at most 1 KB, reads a JSON object
`{ theme, scheme }` from localStorage and sets validated attributes on `html`
synchronously. Blocked storage or invalid values are ignored. Persisting
choices is the host application's responsibility.

`exportThemeResolver(theme)` produces a DTCG 2025.10 Resolver Module document.
Its `mode` modifier has eight complete contexts for the combined scheme,
contrast and motion states, so overlapping token overrides stay deterministic.
The test validates against a vendored copy of the official current schema.

A style selector can target a native part with `(selector (type button)
(part root))`. Hover, pressed and disabled states apply to the host. Checked follows
the native checked input or ARIA checked input inside the host. Focus and
selected states apply to the part. This lets non-interactive
indicators follow the control while native inputs retain focus semantics.
