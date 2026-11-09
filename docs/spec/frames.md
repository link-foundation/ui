# Independent frames and optical materials

`@link-foundation/ui-themes/classic/frames` reads the following vocabulary
with ui-core's official Links Notation projection. These are reusable frame
schemas, separate from component documents and surface materials.

```lino
frames
  panel
    corner top-left cut
      size 60
      width 40
      stroke 2
      color '#71e3ff'
    edge top bracket
      stroke 3
      gap 24
    state hover
      edge bottom accent
        stroke 4
  button
    extends panel
    corner bottom-right round
      size 12
```

Levels are `panel`, `block`, `control`, `button`, `field`, `tab`, `chip`, `menu`, `nav`,
`subnav` and `table`. Each level explicitly inherits one other level or starts
with square corners and one-pixel lines. Cycles and missing parents are errors.
Corners are `top-left`, `top-right`, `bottom-right`, `bottom-left`; edges are
`top`, `right`, `bottom`, `left`. A corner's shape is `square`, `cut`, `tall`,
`wide`, `round`, `scoop` or `notch`. An edge's line is `none`, `gap`, `line`,
`accent` or `bracket`. `accent` uses its independently configured stroke.

Sizes, widths, heights, strokes and gaps are nonnegative finite **pixels**,
without the legacy helper's 48-unit cap. Width and height override size;
tall halves the default width and wide halves the default height. To fit
small elements, `frameGeometry` scales all corner dimensions by the largest
common factor no greater than one for which neighboring corners do not overlap.
It returns a contour, CSS `clipPath`, fitted dimensions and a transparent SVG
containing independently colored strokes. Round and scoop use quadratic curves;
notch uses steps. Brackets paint only the configured length at each edge end.
Gaps use an SVG dash pattern. Strokes are centered on the contour.

States are `hover`, `active`, `selected`, `focus`, `disabled`. Resolution first
merges the inheritance chain's base values, then each requested state in caller
order, from parent to child. A state overrides properties individually. Unknown
or duplicate declarations and properties are errors. The existing `frameStyle`
helper retains its legacy behavior; use `readFrames` / `resolveFrame` /
`frameGeometry` for the independent pixel contract.

## Responsive stylesheets

`framesCss(frames, options)` runs in Node without a DOM. It returns deterministic
`properties`, `base`, `levels` (one string per declared level), and `fit` strings,
plus a `controls` inventory. Load the chunks in that order. Inheriting levels
reuse shared geometry; their chunks contain only parameter declarations, aliases
and state selectors.

```js
import {
  readFrames,
  framesCss,
  frameLayers,
} from '@link-foundation/ui-themes/classic/frames';

const frames = readFrames(source);
const css = framesCss(frames, {
  scope: ':root',
  prefix: 'frame',
  levels: { panel: ['article', '.card'], block: ['.block'] },
  boundaryAttribute: 'data-preview',
});
const stylesheet = [
  css.properties,
  css.base,
  ...Object.values(css.levels),
  css.fit,
].join('\n');
const decoration = frameLayers(); // Insert before the host's content.
```

`levels` defaults to `[data-frame='LEVEL']` for every declared level. Each host
selector has its own `:where()`. Hosts are positioned and isolated; decoration
layers are absolute size containers, so intrinsic content layout is preserved.
Keep the host background transparent and set `--frame-material` to its material
background. The material alone is clipped; cutouts reveal the parent. Strokes
are centered on the contour in separate transparent layers. Ordinary resizing
requires no JavaScript. CSS uses container units, typed arithmetic, `hypot()` and
`@scope`; the browser tests cover Chromium and WebKit. Quadratic corners use 16
polygon segments (maximum chord deviation 0.18 px at 128 px); the SVG reference
retains exact quadratic paths.

A panel inside a panel uses `block` automatically when that level is declared.
`boundaryAttribute` restarts this nesting inside a preview. Explicit block
selectors work independently. For scaled inheritance:

```lino
frames
  panel
    corner top-left cut
      size 128
      line bracket
      arm 16
      stroke auto
    edge top line
      style double
      stroke 2.5
  block
    extends panel
      scale 0.6
    mode frame
  control
    extends panel
      scale 0.35
    mode own
    layer below
    opacity 0.4
    min-width 80
    fitScale 0.5
    corner top-left round
      size auto
```

`scale` is 0.1–1, default 0.6 for block, 0.35 for control and 1 otherwise; it multiplies inherited corner dimensions and arms,
never strokes. Sizes have no upper cap. `auto` dimensions inherit and scale.
Corner `stroke auto` reads its edge width; edge `stroke auto` reads level stroke
(default 1 px). Stroke widths accept 0–12 px; explicit corner stroke widths use half-pixel steps.

Corner `line` is independent of shape: `none` hides it, `gap` also stops adjacent
edges one fitted arm length short, `line` uses the corresponding clockwise edge
color, `accent` uses corner color, and `bracket` adds fitted arms. A square
accent draws a tick of the configured corner size on both adjacent edges.
Corner color defaults to `currentColor`; supply a bright token for accents.
Edge or level `style` is `solid`, `dashed`, `dotted` or `double`, independent of
edge `line`. Dots have length `max(1px, stroke)`. Double splits the total width
into two equal lines separated by one equally wide gap.

`mode frame` uses the explicit parent's frame; `own` uses the level's ordinary
inherited values and explicit overrides; `border` collapses corner extents and
keeps edge styles and states. With no explicit parent, frame behaves as own.
`layer above` (default) paints strokes above content; `below` paints them between
material and content. Level `opacity` applies to strokes only. Colors accept
literal typed colors or token names, optionally with `at N%`, such as
`'primary at 30%'`, compiled to `color-mix()` with `--color-primary`.

### Live scope controls

Change controls on the configured scope element; no stylesheet regeneration is
needed. Replace `frame` with `prefix` and `panel` with the level name. Corner IDs
are `tl`, `tr`, `br`, `bl`; edge IDs are `top`, `right`, `bottom`, `left`.

| Parameter             | Scope control                                                         | Value                     |
| --------------------- | --------------------------------------------------------------------- | ------------------------- |
| Corner dimensions     | `--frame-panel-tl-size`, `-width`, `-height`, `-arm`                  | CSS length                |
| Corner stroke/color   | `--frame-panel-tl-stroke`, `-color`                                   | CSS length/color          |
| Corner shape/line     | `data-frame-panel-top-left-shape`, `-line`                            | Shape/line vocabulary     |
| Edge dimensions/color | `--frame-panel-top-stroke`, `-gap`, `-color`                          | CSS length/color          |
| Edge style/line       | `data-frame-panel-top-style`, `-line`                                 | Style/line vocabulary     |
| Level stroke          | `--frame-panel-stroke`                                                | CSS length                |
| Inheritance scale     | `--frame-panel-scale`                                                 | Number, 0.1–1             |
| Level opacity         | `--frame-panel-opacity`                                               | Number, 0–1               |
| Level choices         | `data-frame-panel-mode`, `-layer`, `-style`                           | Modes/layers/styles above |
| Thresholds            | `--frame-panel-min-width`, `-max-width`, `-min-height`, `-max-height` | Number of pixels, 0–1600  |
| Threshold scale       | `--frame-panel-fitScale`                                              | Number, 0–1               |

For abbreviated table entries, keep the full stem: for example `-width` in the
first row means `--frame-panel-tl-width`. `css.controls` lists complete names,
types, inheritance and choices for settings UIs. Keep live values in the same
ranges as the schema. Scope lengths, colors and images are registered as typed
inherited properties. Inputs containing `currentColor` stay unresolved until
the typed drawing alias, preserving host color and registration-free rendering
in both engines. Scope-only limits and scale do not inherit. Geometry
aliases and the per-element uniform fit factor do not inherit. Omitting the
`properties` chunk preserves rendering; registration enables typed transitions.

CSS state rules use equal specificity in this order: hover, active, selected,
focus, disabled. Hover excludes disabled and ARIA-disabled hosts. Focus uses
`:focus-visible`. Selection defaults to `[aria-selected='true']`,
`[aria-pressed='true']`, `[aria-current='page']`; override with
`options.selected: ['.chosen', '[data-selected]']`. Each state's declarations
inherit from parent to child. Compound states preserve partial overrides: a
pressed color change retains a double edge selected by hover. ui-style accepts `active` as well as its existing
`pressed` alias.

### Optional threshold fitting

Uniform CSS fitting always prevents neighboring corner extents from overlapping
at every positive host size. Threshold fitting additionally multiplies fitted
corners and arms by `fitScale` (default 0.5); 0 gives a plain rectangle. A limit
of 0 disables that bound. Opt in to the small ui-dom helper only when needed:

```js
import { observeFrameFit } from '@link-foundation/ui-dom';
const fit = observeFrameFit(document, {
  scope: document.documentElement,
  levels: { panel: ['article', '.card'], block: ['.block'] },
  boundaryAttribute: 'data-preview',
});
// Refresh after external stylesheet/media-query changes to scope limits.
fit.refresh();
// On teardown:
fit.dispose();
```

The helper owns one ResizeObserver only while at least one level has limits.
It marks outside hosts with `data-frame-fit="outside"`, deduplicates writes,
tracks insertions and selector changes, and restores original markers when
untracked or disposed. Numeric scope attribute changes refresh automatically.
Pass the same selector map, scope, prefix and boundary as the generator.

The [responsive frames example](../../examples/themes/responsive-frames/README.md)
builds a static, script-free before/after comparison at the three reference sizes.

The material layer uses a separate root:

```lino
surface: material
  color '#123456'
  opacity 0.6
  blur 18
  noise 0.1
  refraction 0.2
```

`readMaterial` validates opacity, noise and refraction in [0, 1], and blur in
nonnegative pixels. Default color `inherit` means a transparent surface through
which the parent's material is visible. Defaults for opacity/blur/noise/refraction
are 1/0/0/0. `materialStyle` provides a mixed-alpha background, backdrop blur and
noise/refraction custom properties for a host shader/noise hook. The framework
does not ship a refraction shader or site artwork.

Apply these styles and the contour clip to a dedicated surface layer below
content. Place the transparent border SVG above it. Do not apply opacity to the
content container or paint an opaque corner overlay. The
[optical frames example](../../examples/themes/optical-frames/index.html)
demonstrates this composition.

Viewer preferences are separate from appearance. `applyAppearancePreset` retains
the current `preferences` object (motion, sound, volume and transparency), even
if a preset supplies different preferences. `materialStyle` disables blur and
optical parameters when transparency is disabled. `createEffectGovernor` accepts
host drawing hooks and a sound sink. It schedules work only when motion is
explicitly enabled, reduced motion is false, the surface is visible, and an
effect needs another frame. Hooks return `true` to continue. Hosts feed visibility
and media-query changes into `set`; disposal cancels pending work. Audio events
reach the host sink only when sound and visibility are enabled and volume is
positive. No audio library, assets or automatic browser listeners are installed.
