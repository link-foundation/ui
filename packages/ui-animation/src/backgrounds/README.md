# Decorative background layers

Each entry point exports `mount(target, options)` and returns
`{ update(partial), animate(on), dispose() }`. Import only the effects you use:

```js
import { mount } from '@link-foundation/ui-animation/backgrounds/starfield';
const stars = mount(canvas, { count: 500, motion: 'drift', seed: 'sky' });
stars.update({ color: '#b0ccff' });
stars.animate(false);
stars.dispose();
```

Use `backgrounds/shader`, `backgrounds/beams`, `backgrounds/rain` and
`backgrounds/grid` in the same way. Grid mounts on a positioned div; the others
mount on separate canvases. Hosts own positioning and the CSS fallback. Give
each target `position: fixed; inset: 0; width: 100%; height: 100%`, inside an
isolated stacking context. Stack up to four star canvases for independent looks.
`order` controls z-index; `level` is 0..2 (CSS opacity saturates at 1). Grid level
is 0..4 and maps to opacity 0..1.

The runnable [all-layer example](../../../../examples/animation/backgrounds/)
loads its appearance from nested Links Notation using the official parser.
Serve with `node scripts/serve-static.mjs` and open
`http://127.0.0.1:4173/examples/animation/backgrounds/`.

## Shared lifecycle

Options: `animate` (true), `fps` (5..60, default 60), `dprCap` (2), `level` (1),
`order` (0), `lightScheme` (false), `lightOpacity` (0.65), `adaptive` (true).
WebGL also accepts `resolution` (0.2..1). `lightScheme` follows the system's
light preference and applies `invert(1) hue-rotate(180deg)` and `lightOpacity`.
An explicit `reducedMotion` boolean overrides the media query. Targets are
aria-hidden, ignore pointer events and disappear in print.

Mount renders once. ResizeObserver corrects late CSS sizing; window resize
checks zoom/monitor DPR changes. Identical sizes and changes to unknown metadata
or fps do not repaint. Pausing cancels scheduled frames without clearing. Resume
resets the elapsed-time origin and continues the same model. Live visual updates
repaint even while paused; hidden updates wait until the document is visible.
Dispose is idempotent and removes observers, subscriptions, GPU objects and rain
filters. Missing required graphics APIs or shader compile/link failure yields an
inert handle and hides that canvas so the host's fallback remains visible.
`onError(error)` optionally receives graphics initialization errors.

Layers register with `createEffectGovernor`. By default each owns its governor;
pass `governor` to share an existing instance, whose motion state remains host
owned. Local preference/visibility gates unsubscribe inactive layers. Local fps
limits and synchronous zero-elapsed invalidation complement the governor's
adaptive quality shares. Shares never increase during a layer's lifetime. Slow raw display gaps (>45 ms) are judged after a warm-up
in windows of 30 frames or 1 s. WebGL resolution falls by 0.7 to 0.4, then fps
halves to 0.25; crisp layers lower fps only. Disable with `adaptive: false`.
The governor supplies elapsed seconds and `{scale, fps}` as callback arguments.
The injectable `environment` supplies browser APIs for deterministic tests.

## Sprite starfield

`count` (160) is per 1920×1080, range 0..3000, area-scaled and capped at 6000.
`seed` fixes the sequence. Shapes: `dot`, `soft-dot`, `ring`, `square`, `diamond`,
`cross`, `cross-x`, `star-4`, `star-5`, `star-6`, `sparkle`, `telescope-flare`.

Look controls: `size` (0.5..24), `sizeSpread` (0..1), `color`, `hueSpread`
(0..180 degrees), `brightness` (0..1), `glow` (0..40), `glowColor`,
`twinkleRate` (0..5), `twinkleDepth` (0..1), `rotation` (0..180 degrees),
`spin` (-180..180 degrees/second), `streak` (0..20), `blend`
(`normal`, `add`, `screen`). Nine hue sprites are cached per look/DPR. Colour
changes rebuild sprites and retain positions. Count changes retain the seeded
prefix. `motion` is `still`, `drift`, `warp` or `orbit`; `direction` is degrees
and `speed` is 0..400 CSS px/s. Nearer stars travel faster.

## Shader backdrop and original nebula

`source` is a WebGL 1 fragment shader. The full-screen triangle mesh supplies
`position`. Uniforms `resolution` (backing pixels), `pixelRatio` and `time` are
provided. `uniforms` maps names to numbers, `#rrggbb` colours or `{degrees: n}`.
`times` maps named time uniforms to speeds (default `{time: 1}`); every clock
integrates independently, so changing a speed never jumps. `startTime` is a
number or `random` (a seeded offset). Update uniform/time maps with complete
replacement maps. Failed live shader replacement hides the canvas until a valid
source is supplied. The context requests low power, opaque output and no MSAA.

```js
import { mount } from '@link-foundation/ui-animation/backgrounds/shader';
import { nebula } from '@link-foundation/ui-animation/backgrounds/nebula';
const options = nebula({ driftSpeed: 1, twinkleSpeed: 1 });
const sky = mount(canvas, options);
sky.update({ times: { time: 2, twinkleTime: 0.5 } });
```

The original analytic nebula supports `gas` (0..2.5), `hue` (degrees, -180..180),
`starDensity` (0..4), `starBrightness` (0..2.5), `twinkle` (0..5), `vignette`
(0..1), `zoom` (0.3..3), `gasColor1` through `gasColor4`, `starColor` and
`starSize` (0.5..3). `driftSpeed` is 0..8. Artwork-specific host shaders stay
host content.

## Grid-line beams

`cellSize` (64), `style` (`comet`, `segment`, `pulse`, `scan`), `direction`
(`horizontal`, `vertical`, `both`), `bothSenses` (true), `count` (1..40),
`speed` (20..1500 CSS px/s, each beam 0.75..1.25×), `length` (10..800), `width`
(0.5..8), `color`, `glow` (0..40 device px), `pause` (0..10 s), `snap` (true),
`drift` (CSS px). Geometry/direction changes reseed; appearance updates retain
paths. Reduced motion places beams along their seeded paths.

## Glyph rain

`paint(ctx, glyph, x, y, size, glow)` and `pick()` let the host supply its own
artwork. Default glyphs are seeded digits painted with monospace text.
`cellSize` (64) gives two columns per cell; `step` is 20..400 ms; `columnSteps`
is 1..8; `density` is 0.05..1; `restart` is 0.005..0.5; `fade` is 0.01..0.5;
`glow` is 0..40 device px; `padding` is 0..16, capped at 3/8 cell; `color`,
`visible` and `drift` update live. `visible: false` leaves drift running.

Cadence uses the median of the last 30 display gaps below 100 ms, rounds the
step to whole frames and never catches up multiple steps in one frame. A 105 ms
step is every 6 frames at 60 Hz and 13 at 120 Hz. Destination-out fading keeps
the canvas transparent. Old heads are repainted without glow. About once per
second an SVG alpha table clears values ≤9/255; a pixel pass covers engines
without working SVG filters. Reduced motion paints a deterministic static field
with alpha 0.2..0.8.

## Grid pattern and registration

`cellSize` (32..128), `lineWidth` (0.5..4), `markLength` (0.05..1), `pattern`
(`lines`, `dashed`, `crosses`, `dots`), `level` (0..4), `tint` (`line`, `accent`,
`second-accent`, `custom`), `color`, `radialFade`, `period` (0..120 s, 0 still).
Theme tints use `--color-line`, `--color-accent` and `--color-accent-2`.

The CSS pattern is one extra cell tall. `onDrift(px)` receives the shared offset;
forward it to rain and beams with `update({drift: px})`. At a wrap, the offset
shifts by exactly one cell. See the example's wiring.
