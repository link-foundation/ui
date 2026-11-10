# Default doublet network provider

`createDoubletProvider()` is the built-in geometry/SVG provider for
`createNetworkPresentation`. It implements the behavior of
[issue 227](https://github.com/link-foundation/ui/issues/227) independently of
consumer code. Existing `link-view`, layouts and `networkToSvg` remain available.

```js
import {
  createNetworkPresentation,
  createDoubletProvider,
} from '@link-foundation/ui-components/links-view';

const presentation = createNetworkPresentation(createDoubletProvider());
await presentation.update({
  items: [
    [1, 1],
    [2, 2],
    [1, 2],
  ],
  index: '0',
  options: 'layout circle\ncaption\n  mode pairs\n',
});
const svg = presentation.toSvg();
const png = await presentation.toRaster('image/png'); // in a browser
// An existing <links-network> can display exactly this scene:
// element.presentation = presentation;
```

Pairs have sequential 1-based ids; `0` means free, and an end equal to the
link's own id means self-reference. Both ends must be integers in `0..n`.
The provider also accepts the bridge's `{id, source, target}` records, in
sequential order, with numeric ids or their decimal strings. The empty network
is valid. No endpoint nodes are invented.

## Options

Options are nested Links Notation, parsed by the official parser through
ui-core. Unknown, repeated or out-of-range fields are rejected. Each top-level
field appears once except `link`, which appears once per overridden id.
Omitted fields use the defaults below. Partial presentation updates retain
options verbatim; a new options string replaces the whole options document.

```lino
layout circle
order 3 1 2
layoutAspect 1
columns 0
spread 1
rotation 0
angles mirror
tension 0.4
gaps 0.08 0.08 0 0
link 1
  turns 30 -30
  gaps 0.2 ~ 5 ~
start
  shape bar
  size 2.5
  angle 70
  offset 2.5
end
  shape arrow
  size 3.5
  angle 45
middle
  shape dot
  size 2
background
  type linear
  color '#ffffff'
  color2 '#dbeafe'
  angle 45
card
  color '#ffffff'
  opacity 0.8
  border double
  borderColor '#202b3d'
  width 1
  radius 8
  inset 3
caption
  mode pairs
  font mono
  size 5
width 640
height 640
```

| Fields                       | Default and range                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `layout`                     | `auto`: circle for 1–4, hex otherwise. Also grid, spiral, dice, cards, force, layered                                         |
| `order`                      | Circle permutation of every id, e.g. `3 1 2`                                                                                  |
| `layoutAspect`               | 1, 0.3..3; multiply x by its square root and divide y by it                                                                   |
| `columns`                    | 0 (auto), integer 0..30; row/tile layouts use this count                                                                      |
| `spread`, `rotation`         | 1 (0..100), 0 degrees (−180..180), applied before fit                                                                         |
| `free`, `loop`               | 1 (0..10); free length 0.42 (lone 0.9), loop handle radius 0.8 (lone 1.25) times the multiplier                               |
| `bulge`, `loopBend`          | 0 degrees (−180..180); loop width multiplier is `exp((bulge + loopBend)/180)`                                                 |
| `angles`                     | `fixed` or `mirror`                                                                                                           |
| `sourceAngle`, `targetAngle` | 30 degrees (−180..180), turned toward the mirror side; aligned chords stay straight with no turns                             |
| `tension`                    | 0.4 (0..2), times chord length                                                                                                |
| `gaps`                       | Start/end 0.08 layout units (0..1), before/after middle 0 box units (0..30)                                                   |
| `link <id>`                  | Nested `turns` (two integer degrees, −180..180) and/or `gaps` (four values); `~` or `null` inherits a global gap              |
| `padding`                    | 9 (0..48); margin is min(48, max(padding, largest marker extent + half stroke width))                                         |
| `frame`                      | Optional `scale x y` or quoted `'scale x y'`; skips fit, three finite values with absolute value ≤ 1e6, scale > 1e-9 and ≤ 60 |
| `start`, `end`, `middle`     | Nested marker fields below                                                                                                    |
| `strokeWidth`, `color`       | 1 (0.5..10), `#202b3d`                                                                                                        |
| `dash`                       | `solid`, `dashed`, `dotted`, `dashdot`, `long`; lengths relative to stroke width                                              |
| `linecap`, `arrowJoin`       | `round` / `butt` / `square`; `miter` / `round` / `bevel`                                                                      |
| `opacity`, `glow`            | 1 (0.1..1), 0 (0..12); Gaussian blur combined with the sharp scene                                                            |
| `balanceArrows`              | true; compensates end arrow/triangle and start tail tips                                                                      |
| `width`, `height`            | 640 px each (64..4096); shorter viewBox side is always 100                                                                    |

Marker shapes are `bar`, `arrow`, `triangle`, `tail`, `dot`, `circle` (ring),
`square`, `diamond`, `none`. Each independently accepts `size` (0.5..15),
`angle` (5..85 degrees; arrow/triangle/tail only), `offset` (−20..20 box units
along the uncut arc, positive inward at either end), `across` (−20..20 along
the path's normal) and `rotation` (−180..180 degrees; ignored for dot/circle/none).
The middle offset follows the source-to-target direction. Offsets beyond the
path extend along its tangent. Defaults are as shown above; all other marker
offsets, across and rotations default to zero.

An explicitly written `offset`, `across` or `rotation`, even zero, disables
compensation for that marker. The marker is moved back along the endpoint's
local tangent by its painted tip extension: half stroke width divided by
`sin(angle)` for miter, half width for round, half width times `sin(angle)`
for bevel. This keeps the painted tip exactly on its anchor even on a curved
end. The line is trimmed by the same extension plus its cap radius. Miter
limits exceed `1/sin(angle)` so acute tips are preserved. Marker shapes and
settings are independent of the legacy fixed-size `MARKERS` catalogue.

Background fields: `type` is transparent (default), solid, linear or radial;
`color` and `color2` default to white and `#dbeafe`; `angle` is −180..180.
Card fields: `color` white, `opacity` 0 (0..1), `border` none/solid/dashed/dotted/double,
`borderColor` `#202b3d`, `width` 1 (0.1..6), `radius` 0 (0..50), `inset` 0 (0..30).
Caption fields: `mode` none/theory/pairs/number/links/custom, `text` at most 80
Unicode characters, `font` mono/sans/serif, `size` 5 (3..14), `color` `#202b3d`.

Caption notation is defined here: theory is `L = {1=(s,t), ...}`, pairs is
`(s, t) ...`, number is the presentation's decimal index, links is
`1: s t; ...`, and custom is `text`. Caption space is reserved inside the card;
long lines use `textLength` and `spacingAndGlyphs`. Accessible names use compact
pairs through id 9 (`Links network 11 22 12`); larger ids use `(s,t)` to avoid
ambiguity. All text/attributes are XML escaped.

## Geometry and inspection

`doubletGeometry(items, options, index)` returns a structured-cloneable frame.
`places` and `layoutCurves` are in layout units. `positions` and `curves` are
in fitted box units, transformed by `[scale, x, y]`. Every raw curve contains
exactly two cubics sharing its own middle and tangent direction. References
anchor at other links' middles, not arc-length halfway points. A middle's
direction is the bisector of its incoming and outgoing chords. When they cancel
(both references to one place, as in `22 11`), it is the chord from the higher
to the lower link ID turned by +90 degrees, so both links share it. A fixed
angle turns each reference end toward the side the mirror end lies on; a lens
(two references to one link) mirrors at ±45 degrees, so fixed 45 equals mirror.
A start or end gap at another link's middle moves that visible end and its
handle back along the end tangent. Free and self-loop end gaps and middle cuts
are trimmed by arc length. The visible curve may have a separate subpath around
a middle cut; a consumed half is null. Symmetric self-loop halves are point
reflections with reversed parameter direction.

The shared clean input for the collision solver of #228 is `22 11` with the
[fixture](../../packages/ui-components/tests/links-view/fixtures/doublet-22-11-clean.lino)
`link 1` `turns -90 90` (link 2 unturned, fixed 30-degree ends, default gaps).
It paints no crossing and keeps a painted gap of at least 1 box unit; without
turns `22 11` crosses twice ([#249](https://github.com/link-foundation/ui/issues/249)).

Circle chord neighbours, grid/hex neighbours and dice pips have unit spacing
before transforms; cards use two columns at ±0.7. Dice groups of six pips tile
in reading order; the final tile uses the remaining 1–6 pip pattern. Force reuses the existing seeded d3-force layout with at most 100 ticks;
layered reuses the existing Dagre layout. The nearest distinct pair is
normalized to one layout unit. Auto
column counts consider aspect. All placements share aspect/spread/rotation
transforms. A zero spread intentionally collapses places. Uniform fitting has
a scale cap of 60 and reserves room for cards and captions. Pinned frames
intentionally override these automatic fit decisions.

`doubletOptionAvailability(items, options)` reports booleans for contextual
controls, including `free`, `loop`, `loopBend`, `angles`, `sourceAngle`,
`targetAngle`, `order`, `columns`, `padding`, caption/background fields and
marker balancing. Editors can use these to hide inert controls.
`createDoubletProvider({debug})` optionally reports geometry counts and fit
transforms; it is silent by default. The existing presentation bridge provides
transactional updates, SVG preview/export equality, and PNG/JPEG/WebP encoding.

See the [original browser gallery](../../packages/ui-components/examples/doublet-network.html)
and [verification inventory](../case-studies/issue-227/README.md).
