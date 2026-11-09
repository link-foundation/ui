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

Levels are `panel`, `control`, `button`, `field`, `tab`, `chip`, `menu`, `nav`,
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
[0, 48] pixels. Default color `inherit` means a transparent surface through
which the parent's material is visible. Defaults for opacity/blur/noise/refraction
are 1/0/0/0. `materialStyle` provides a mixed-alpha background, backdrop blur and
deterministic grain. The opt-in refraction provider supplies a smoothed SVG
displacement filter. See [optical materials](optical-materials.md) for the complete
parameter, static CSS, visibility and palette contracts. No site artwork ships.

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
