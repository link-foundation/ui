# Optical materials and palette packs

Materials are independent, clipped surface layers below content and frame strokes.
Use `readMaterial`, `materialStyle`, `opticalMaterialCss`,
`createRefractionProvider`, and `observeMaterialVisibility` from
`@link-foundation/ui-themes/classic/materials`. The framework ships original
mechanisms and fixtures; consumer presets, artwork and palette content stay local.

```lino
surface: material
  color '#234567'
  opacity 0.6
  blur 12
  saturation 150
  tint theme
  tint-level 0.2
  highlight 0.4
  depth 0.2
  depth-blur 30
  noise 0.1
  refraction 0.5
  sheen 0.3
  sheen-angle 120
  light-angle 40
```

Numeric parameters use these inclusive bounds. Absent new fields are neutral;
the original four-property style object stays byte-for-byte compatible when new
fields and grain are absent (except the intentional opacity-zero suppression).

| Field                        | Range              | Default |
| ---------------------------- | ------------------ | ------- |
| opacity, noise, refraction   | 0–1                | 1, 0, 0 |
| blur                         | 0–48 px            | 0       |
| saturation                   | 100–300 %          | 100     |
| brightness                   | 70–150 %           | 100     |
| contrast                     | 50–200 %           | 100     |
| tint                         | theme or hex color | theme   |
| tint-level, highlight, depth | 0–1                | 0       |
| depth-blur                   | 0–80 px            | 0       |
| shadow                       | 0–1                | 0       |
| shadow-blur                  | 0–100 px           | 0       |
| shadow-distance              | 0–60 px            | 0       |
| shadow-spread                | −20–30 px          | 0       |
| sheen                        | 0–0.8              | 0       |
| sheen-angle, light-angle     | 0–360 degrees      | 0       |
| border-width                 | 0–8 px             | 0       |
| border-light                 | 0–1                | 0       |

Highlight lines use full intensity on top, 35% on each side and 25% at the
bottom. Tint, sheen, inner light, shadow and grain alpha multiply material
opacity; content opacity is never set. At zero opacity the material emits no
backdrop filter, gradients or noise. Frame strokes belong to a separate sibling.
The ui-style `glow` property accepts 0–4, multiplied by 24 px.

The filter chain is refraction, blur, saturate, brightness, contrast. Neutral
operations are omitted. Grain is a 128 px SVG fractal-noise tile with fixed seed,
stitched edges, zero saturation and constant alpha `noise * opacity`. Its URI
is a pure function of those two inputs: changing other parameters leaves the
image source unchanged, so the browser reuses its decoded image. No canvas,
network requests, random source or unbounded image cache is used. Grain paints
over tint and beneath content; the host's contour clips the layer.

## Refraction

```js
const provider = createRefractionProvider(document, {
  scale: 40,
  detail: 12,
  octaves: 2,
  smoothing: 2,
  seed: 13,
});
const style = materialStyle(material, {
  transparency: 'auto',
  refractionProvider: provider,
});
```

The document owns one inert, zero-size, aria-hidden SVG provider. Creation is
idempotent; the first call chooses its configuration. Strength-specific filter
definitions are shared inside that single SVG, so separate materials keep their
own strength when another surface is styled. `scale` is 0–150,
`detail` 2–60, integer `octaves` 1–4, `smoothing` 0–10 and integer `seed` 0–100.
The base frequency is `detail / 1000`; Gaussian blur smooths the turbulence before
it displaces `SourceGraphic`. Effective scale is `scale * refraction`.

SVG URLs in backdrop filters are allowlisted for Chromium. `CSS.supports` alone
is insufficient: Firefox and WebKit can parse a URL while failing to apply it.
Those engines receive the ordinary blur/color chain, without a URL. Refraction
is opt-in and stops for zero opacity, zero strength, transparency false/off,
`reducedTransparency: true`, or transparency auto plus the reduced-transparency
media query. Reapply material styles on preference/media changes. Dispose the
provider when its document no longer needs it.

## Static surfaces and motion

`opticalMaterialCss(selector)` emits CSS using `--material-FIELD` properties.
Numeric optical ratios remain unitless; blur/distance/spread/width need `px`,
saturation/brightness/contrast need `%`, and angles need `deg`. Put the rules on
a dedicated positioned surface inside a positioned, contour-clipped host;
content and frame are siblings above it. `--material-color` falls back to
`--color-surface`. Tint uses the same theme fallback.

Set `data-material-noise` when noise is positive, remove it at zero, and mirror
zero opacity with `data-material-opacity="0"`. This marker removes the filter
and generated layers entirely, even in engines without CSS style queries.
The static API has no script or mutation observer. Surface owners update these
two presence markers with their variables. Transparency is opaque by default
and enables filters only under the non-reduced media query and outside
`data-transparency="off"` subtrees. Do not supply a refraction URL manually:
use the provider's `reference` as `--material-refraction-filter` only after
its engine and preference checks pass.

Sheen is static until the surface has `data-material-motion`. Animation and
hover sweep run under no-preference motion; `data-motion="on"` explicitly
overrides reduced motion. `data-motion="off"` on the surface or an ancestor
always stops both. Apply the same attributes/preferences as the effect governor.

## Backdrop budget and scoped presets

```js
const budget = observeMaterialVisibility(root, '.surface', {
  margin: 200,
  onVisibility: (element, visible) => governors.get(element)?.set({ visible }),
});
// Later: disconnect observers, remove suppression rules and restore all surfaces.
budget.dispose();

const next = applyAppearancePreset(current, preset, [
  'blur',
  'noise',
  'refraction',
  'saturation',
  'sheen',
]);
```

The default margin is `200px 0px`; a CSS root-margin string also works. An
IntersectionObserver handles geometry, a MutationObserver handles added/removed
subtrees, and one screen-only stylesheet suppresses offscreen backdrop filters,
including hover and refraction. Background, geometry, frame, accessible content
and print styles remain unchanged. Newly observed surfaces start suppressed
until their first intersection notification. Without IntersectionObserver the
helper makes no changes. Disposal restores the original declarations and
releases references to removed nodes. Visibility callbacks can feed one governor
per surface; applications may aggregate them if several surfaces share a governor.

The optional preset key list is an allowlist. Unlisted geometry and all current
viewer preferences remain intact. With no list the original appearance-wide
merge behavior is preserved. Values are cloned.

## Palette packs and alpha

```js
// Each value is a ResolvedTokens map with its dark/light modes.
const css = toCss(new Map(palettes), { pack: true, channels: true });
// Or resolved Theme objects, including the existing scheme/contrast/motion axes:
const themeCss = compileThemeCss(themes, { channels: true });
```

`toCss` packs scope defaults to `[data-palette="NAME"]` and combine it with
`:is([data-mode="dark"])` / `:is([data-mode="light"])`. Customize these with
`paletteSelector`, `modeSelector`, `modeMedia` and `prefix`.
`compileThemeCss(Theme[])` scopes each theme to its palette attribute and retains
its `data-scheme`, contrast and motion axes; `paletteSelector` customizes the
palette boundary. Single-theme output keeps the original theme selector.

With `channels: true`, each color also emits `--color-NAME-rgb: r g b` in sRGB
byte units, converting oklch and clamping out-of-gamut values. Alias channels
remain variable references. Use `rgb(var(--color-primary-rgb) / 0.35)` for an
independent alpha. Channel triplets deliberately omit the token's own alpha;
`color-mix(in srgb, var(--color-primary) 35%, transparent)` preserves it.
The original 12-palette × 2-mode fixture is
`packages/ui-tokens/tests/fixtures/optical-palettes.lino`.

For picked colors, ui-settings exports `hexToChannels('#123456')`, returning
`'18 52 86'`. It accepts short/long RGB and RGBA hex; CSS chooses alpha.
`applyToRoot(schema, values, root, { channels: true })` also writes a `-rgb`
variable beside each applied color variable, after normal settings validation.
The default settings output and default token output do not add channels.
