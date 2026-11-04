# @link-foundation/ui-animation

Animations of the associative UI framework, written in Links Notation. The
package has four parts:

1. **a model** (`loadAnimations`): `animation` links with keyframe tracks,
   easings, springs and procedural effects, `timeline` links with `at`,
   `sequence`, `parallel` and `stagger`, and `(on STATE ...)` triggers;
2. **a pure sampler** (`sample`, `sampleLayers`): the values of an animation
   at a time, as a function of `(animation, t, seed)` only, so animations
   can be scrubbed, recorded and tested;
3. **a WAAPI compiler** (`toWaapi`): keyframes and options for
   `element.animate()`;
4. **a player** (`createPlayer`): it runs CSS properties on the Web
   Animations API and effects and non-CSS properties on a frame loop
   driven by an injectable clock, follows reduced motion and plays the
   triggers of a [ui-store](../ui-store/README.md) document.

Safety is part of the model: `validateAnimation` reports fills that leave
`clip-path` or transforms on an element, photosensitive flashes (WCAG 2.3.1)
and movement without a reduced-motion variant.

Text is read only by the `parse` function of
[`@link-foundation/ui-core`](../ui-core/README.md), the official
`links-notation` parser. That is the only runtime dependency.

```js
import {
  loadAnimations,
  validateAnimations,
  createPlayer,
} from '@link-foundation/ui-animation';
import { mountDocument } from '@link-foundation/ui-dom';

const { store, handle } = mountDocument(app, documentText);
const model = loadAnimations(animationsText); // { animations, timelines, triggers, diagnostics }
validateAnimations(model, { resolveToken }); // [] when it is safe

const player = createPlayer(handle, { animations: model, resolveToken });
player.bindTriggers(store); // (on pressed ...) plays when `pressed` turns on
await player.play('intro').finished;
```

The [example](../../examples/animation/index.html) plays an intro timeline
on a ui-dom document and has a reduced-motion toggle.

## Model

```lino
panel-enter: animation
  duration 300ms
  easing
    cubic-bezier 0.2 0 0 1
  fill backwards
  track opacity
    key 0 0
    key 1 1
  track translate
    key 0 '0 8px'
    key 1 '0 0'
  reduced-motion
    duration 0ms
bounce: animation
  duration 600ms
  easing
    spring
      stiffness 300
      damping 20
      mass 1
  track scale
    key 0 0.9
    key 1 1
title-reveal: animation
  target title
  duration 900ms
  effect decipher
    seed 42
press-feedback: animation
  target ok
  duration
    token motion.duration.short
  easing standard
  track scale
    key 0 1
    key 0.5 0.96
    key 1 1
  on pressed
intro: timeline
  at 0ms
    play panel-enter
      target sidebar
  at 120ms
    stagger 50ms
      play bounce
      targets item-1 item-2 item-3
```

Write one top-level link per line: Links Notation joins the links of one
line into a single link.

### `animation`

| Part                                                        | Values                                                                  | Default                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| `(target ID)`                                               | the store ID of the element it plays on                                 | the `target` of `play`              |
| `(duration TIME)`                                           | `300ms`, `0.3s`, `(token motion.duration.short)`                        | the settle time of a spring, else 0 |
| `(delay TIME)`                                              | as `duration`                                                           | `0ms`                               |
| `(iterations N)`                                            | a number or `infinite`                                                  | `1`                                 |
| `(direction D)`                                             | `normal`, `reverse`, `alternate`, `alternate-reverse`                   | `normal`                            |
| `(fill F)`                                                  | `none`, `forwards`, `backwards`, `both`, `auto`                         | `none`                              |
| `(composite C)`                                             | `replace`, `add`, `accumulate`                                          | `replace`                           |
| `(easing E)`                                                | see [Easings](#easings)                                                 | `linear`                            |
| `(track PROPERTY (key OFFSET VALUE [EASING])...)`           | keyframes of one property; offsets 0–1, sorted                          |                                     |
| `(effect NAME (seed S) (PARAM V)...)`                       | a registered procedural effect                                          |                                     |
| `(envelope bell\|sustain [(attack TIME)] [(release TIME)])` | the weight of an additive layer over its run                            | none                                |
| `(persist true)`                                            | allows a final `clip-path` or transform to stay (see [Safety](#safety)) | `false`                             |
| `(on STATE [(play ID [(target ID)])])`                      | plays this animation (or `ID`) when its target enters `STATE`           |                                     |
| `(reduced-motion PART...)`                                  | the parts that replace these under reduced motion                       | opacity tracks only, duration 0     |

**Values.** A key value is a number (`0.96`), a length or any CSS text with
units (`'0 8px'`, `'inset(0 100% 0 0)'`, `'45deg'`), a colour (`'#FF0000'`,
`(oklch ...)`, `(rgb ...)`, mixed in OKLCH) or `(token PATH)`. Texts with the
same shape are mixed number by number; other values switch at the middle.

**Properties.** Any CSS property runs on WAAPI. `text`, `label`, `value`,
`title`, `placeholder` and `progress` are not CSS: the player writes them
on every frame (`text` as the text content, `value` as the form value, the
others as attributes) and restores them when the animation no longer
applies (after its end without a fill).

**States.** A trigger state is `hover`, `focus`, `pressed` or `disabled`: a
store property of that name whose value is not `false`. An element can
also play animations on others: `(ok: button (on hover (play glow (target
help))))`.

### Easings

- a name: `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`,
  `step-start`, `step-end`, or a theme easing such as `standard` or
  `emphasized`, read from the token `motion.easing.NAME` when the theme
  has it;
- `(cubic-bezier x1 y1 x2 y2)`;
- `(steps n [start|end|jump-both|jump-none])`;
- `(spring (stiffness k) (damping c) (mass m))`: a closed-form damped
  oscillator. Without `(duration ...)` the animation lasts until the spring
  settles within 0.05% of its target; on WAAPI it runs as a CSS `linear()`
  (`toCssLinear`).

A key may carry the easing of the segment that starts at it:
`(key 0 1 ease-out)`. Key offsets are literal fractions of the iteration duration, after delay and
playback direction. Animation easing is the default for each segment; a key's
explicit easing overrides it for the segment starting there. With no easing,
interpolation is linear. Thus the unchanged `press-feedback` sample reaches
scale `0.96` at 50% even with `easing standard`. See the normative
[timing contract](../../docs/spec/animation-timing.md) resolving #52 and #57.
Procedural effects have no key segments and retain whole-iteration easing.

### `timeline`

```
(NAME: timeline ITEM...)
ITEM = (play ID [(target ID)] [(targets ID...)])
     | (at TIME ITEM...)       starts its items TIME after its parent
     | (sequence ITEM...)      starts each item when the one before ends
     | (parallel ITEM...)      starts its items together
     | (stagger STEP ITEM... [(targets ID...)])
                               the i-th target (or item) starts i * STEP later
```

`(play ID)` can play another timeline. A timeline that plays itself is a
`timeline-cycle` diagnostic. `flattenTimeline(model, id)` returns the flat
schedule `[{ start, id, target }]`.

### Diagnostics

`loadAnimations(text).diagnostics` and the validators use the ui-core shape
`{ code, severity, message, at }`:

| Code                     | Severity | When                                                                                  |
| ------------------------ | -------- | ------------------------------------------------------------------------------------- |
| `anonymous-animation`    | warning  | an `animation` or `timeline` has no id                                                |
| `unknown-sublink`        | warning  | a part the model does not know                                                        |
| `invalid-value`          | error    | a value of the wrong type (`(duration fast)`)                                         |
| `unknown-easing`         | error    | an easing that is not a name, bezier, steps or spring (a warning for an unknown name) |
| `empty-track`            | error    | a track without keys                                                                  |
| `key-offset-range`       | error    | a key offset outside 0–1                                                              |
| `key-offset-order`       | error    | key offsets that are not sorted                                                       |
| `unknown-effect`         | warning  | an effect that is not registered                                                      |
| `unknown-state`          | warning  | `(on STATE)` with a state that is not one of the four                                 |
| `unknown-animation`      | error    | `play` of an id that is not an animation or timeline                                  |
| `timeline-cycle`         | error    | a timeline that plays itself                                                          |
| `persistent-fill`        | error    | see [Safety](#safety)                                                                 |
| `flash`                  | error    | see [Safety](#safety)                                                                 |
| `missing-reduced-motion` | warning  | see [Safety](#safety)                                                                 |

## Safety

`validateAnimation(animation, { resolveToken })` and
`validateAnimations(model, options)` check three rules. They come from
regressions found in [immortality](https://github.com/konard/immortality/tree/main/docs/case-studies/issue-7).

- **Fill (`persistent-fill`, error).** `(fill both)` or `(fill forwards)` on
  a `clip-path`, `transform`, `translate`, `scale` or `rotate` track keeps
  the final value on the element after the animation ends, which clipped
  and shifted panels. Use `(fill none)` or `(fill backwards)`, or write
  `(persist true)` when the end state must stay.
- **Flash (`flash`, error).** WCAG 2.3.1 Three Flashes or Below Threshold.
  `opacity`, `background-color` and `color` tracks are sampled at 60 Hz. A
  change is a swing of relative luminance of at least 0.1 whose darker side
  is below 0.8 (opacity is taken as the luminance of a white layer over
  black, the worst case), and a flash is a pair of opposing changes. More
  than 3 flashes in any one-second window is an error: an 8 Hz
  `(steps 1)` opacity flicker fails, a 0.5 Hz breathing glow passes.
- **Reduced motion (`missing-reduced-motion`, warning).** A `translate`,
  `scale`, `rotate` or `transform` track that runs for more than 0 ms
  without a `(reduced-motion ...)` block. Under reduced motion such an
  animation keeps only its opacity tracks, with duration 0.

The player follows reduced motion with `defaultMotion(element)`: it is
`reduced` when the closest `[data-motion]` ancestor says `reduced`, or when
the user agent prefers reduced motion. It then plays the
`(reduced-motion ...)` variant (`reducedMotionVariant`). Timeline `at`
offsets stay as written.

Randomness comes only from `seededRandom(seed)`: the package never calls
the global random source, so every frame is reproducible.

## GSAP is not used

This package uses the Web Animations API and its own sampler. **GSAP must
never be added**, not even as an optional or development dependency: its
[standard licence](https://gsap.com/community/standard-license/) forbids
its use in tools that compete with its no-code animation products, which
a Links Notation animation editor is. `npm ls gsap` must stay empty (see
[existing solutions](../../docs/case-studies/issue-1/research/existing-solutions.md)).
Motion (MIT) may come later as an optional adapter.

## API

### Model

- `loadAnimations(text)` → `{ animations: Map, timelines: Map, triggers, diagnostics }`.
- `ANIMATION_STATES`, `ANIMATION_DEFAULTS`.

### Sampling

- `sample(animation, tMs, { resolveToken, seed, input })` → `{ scale: 0.96, … }`:
  CSS values as numbers or strings, effect output under its property. Pure:
  the same arguments always give the same values.
- `sampleTyped(animation, tMs, options)` → `{ active, values, effects }` with
  typed values.
- `sampleLayers(layers, tMs, options)`: sums `(composite add)` and
  `(composite accumulate)` layers onto the `replace` layers below them, each
  weighted by its envelope (`bell` is sin²(πp); `sustain` rises over its
  attack, holds and falls over its release, 20% of the run each by
  default), so nothing snaps. A layer is an animation or
  `{ animation, start, seed, input }`.
- `envelopeWeight(envelope, progress, duration)`.

### Easing

`linear`, `cubicBezier(x1, y1, x2, y2)`, `steps(n, position)`,
`spring({ stiffness, damping, mass })` → `{ at(tMs), settleTime }`,
`springEasing(spring)`, `toCssLinear(fn, samples = 40)`,
`easingFunction(easing, resolveToken)`, `easingCss(easing, resolveToken)`,
`NAMED_EASINGS`, `SPRING_TOLERANCE`.

### Effects

- `registerEffect(name, fn, { property = 'text' })`, where `fn` is a pure
  `(input, progress, seed, params) => output`; `getEffect(name)`,
  `effectNames()`.
- `decipher(input, progress, seed)`: the text appears from random glyphs,
  one character at a time in a seeded order. It is ported from
  [immortality `textEffects.ts`](https://github.com/konard/immortality/blob/main/app/src/textEffects.ts)
  (Unlicense).
- `seededRandom(seed)` (mulberry32), `seedNumber`, `hashString`, `mix`.

### WAAPI

`toWaapi(animation, { resolveToken })` → `{ keyframes, options }`. For the
sample `press-feedback` with the sample tokens:

```js
({
  keyframes: [
    { offset: 0, easing: 'cubic-bezier(0.2, 0, 0, 1)', scale: '1' },
    { offset: 0.5, easing: 'cubic-bezier(0.2, 0, 0, 1)', scale: '0.96' },
    { offset: 1, easing: 'cubic-bezier(0.2, 0, 0, 1)', scale: '1' },
  ],
  options: {
    duration: 150,
    easing: 'linear',
    fill: 'none',
    composite: 'replace',
  },
});
```

Only CSS tracks become keyframes (`isCssProperty`, `NON_CSS_PROPERTIES`).

### Player

```js
const player = createPlayer(handle, {
  animations, // LiNo text or a loaded model
  resolveToken, // tokenResolver(resolveTokens(sets, 'material3'))
  clock, // default: requestAnimationFrame and performance.now()
  motion, // 'full' | 'reduced' | (element) => ...; default: defaultMotion
  animate, // default: (element, keyframes, options) => element.animate(...)
  seed, // the seed of effects without (seed ...)
});

const control = player.play('intro', { target, seed, input });
control.seek(75); // every run at 75 ms, paused
control.pause();
control.play();
control.cancel(); // restores the values from before and rejects `finished`
await control.finished;

const unsubscribe = player.bindTriggers(store);
```

`handle` is a ui-dom handle (`nodeFor(id)`), a function of the id, or
`null`. `createManualClock()` gives a clock that only moves on
`advance(ms)`, so tests are deterministic; `systemClock()` is the default.
`triggersFor(model, store, id, state)` lists what plays when an element
enters a state.

## Tests

```sh
node --test packages/ui-animation/tests/*.test.js
npx playwright test tests/e2e/animation.spec.js --project=chromium
```

The Playwright spec checks that `panel-enter` leaves the computed
`translate` and `clip-path` of the panel as they were before it, that the
intro timeline runs with its offsets and stagger, the reduced-motion
toggle, the `pressed` trigger, and the accessibility of the example.

## License

[Unlicense](LICENSE) (public domain).

## Recording format

The recorder stores the clock, inputs, store operations and animation starts,
not pixels. The initial `snapshot` is the store's LiNo operation log, inserting
all roots with their stable IDs and exact property lists. `set` is the readable
form of `setProp`; structural events use the merged store's operation syntax.
Other updates (`removeProp`, positional edits, duplicate properties and rename)
use `set` with an `operation` child carrying the original operation. No store
methods are patched and no fake snapshot/restore API is required.

```js
import {
  createRecorder,
  replay,
  stateAt,
  animationsAt,
  verifyReplay,
  toPlaywright,
} from '@link-foundation/ui-animation';

const recorder = createRecorder({ store, player, root, handle, seed: 42 });
recorder.start();
recorder.mark('saved once');
const text = recorder.stop(); // detaches store, player and DOM listeners
const playback = replay(text, { store, player });
playback.seek(990);
playback.seek(0); // restores the initial snapshot, then applies due diffs
await playback.play();
const spec = toPlaywright(text, { url: '/examples/animation/' });
```

```lino
session-7: recording
  started '2026-11-01T12:00:00Z'
  seed 42
  viewport 1280 800
  document app
  redacted true
  event 0ms
    set ok label OK
  event 840ms
    input pointer down ok
      at 12 8
  event 841ms
    play press-feedback
      target ok
  event 990ms
    set ok label Saved
```

`parseRecording` accepts the official parser's nested and parenthesized forms;
`serializeRecording` writes the canonical nested form and preserves header and
event order. Event times are nonnegative integer milliseconds relative to
`start()`, with file order breaking ties. `started` is the wall-clock origin;
set `started` explicitly alongside an injected monotonic `clock` for fixtures.
Viewport and document ID are inferred from the root, or supplied explicitly.
`stateAt(text, ms)` returns a pure LiNo snapshot. `animationsAt(text, ms)` lists
uncancelled plays with local time and seed; pass `{ model, resolveToken }` to
filter completed animations and timelines before sampling them.

DOM listeners are passive and capture-phase. The render handle maps targets to
stable IDs, and pointer coordinates are relative to the target box. Pointer
moves retain at most one event per 1/60-second bucket for the session. Adjacent
text edits to the same field merge into the final value; intervening diffs or
other events preserve causal order. Password and `(sensitive true)` values are
redacted as `***` in the initial snapshot, insertions, updates and input events
by default. `redact: false` explicitly opts out. A DOM password target is also
remembered for subsequent store updates. `maxEvents` defaults to 100,000;
overflow retains the latest events in a ring and adds `truncated true`. Such
recordings can be inspected, but replay, verification and export reject them
because their missing prefix cannot be reproduced faithfully.

The shared `createManualClock()` runs timers at their exact due times, preserving
insertion order for ties. `advance(ms)` drives replay and player frames without
real time. `replay` applies recorded diffs and seeded animations; it does not
redispatch inputs. `pause()` resolves the pending `play()` call, and `seek()`
pauses playback. Store-triggered animations ignore operations with origin
`replay`, so recorded play events are not fired twice.

`verifyReplay(text, { createApp })` builds a fresh app with `createApp(seed,
clock)`. Return `{ store, dispatchInput(event), dispose?() }`: the verifier
restores the initial snapshot, dispatches only recorded inputs at their recorded
times, then compares resulting store diffs (including timestamps and order).
The injected clock must drive the app's timers too. The asynchronous result
contains `ok` and `{ time, expected, actual }` mismatches. Redacted recordings
can only verify handlers whose observable output is independent of the removed
secret values; a mismatch is reported rather than assuming those values.

Keyboard events use Playwright’s native keyboard API, including default button
activation. Text events skip a fill when the preceding key already produced the
recorded value, avoiding duplicate input notifications. Redacted keys remain
synthetic because their original character is unavailable.

`toPlaywright(text, { url })` exports a Playwright spec with a controlled clock,
viewport, stable `data-link-id` selectors, pointer/key/wheel/text/focus inputs,
property assertions and named `test.step` markers. DOM properties such as labels
and values are asserted directly. For store-only properties such as `pressed`, the page
exposes `window.uiRecordingState(id, name)` returning the property's raw values
(the animation example demonstrates the hook). The exported test includes no
runtime recorder dependency. Redacted text remains `***`; it cannot reconstruct
secrets. No rrweb code or dependency ships in this package.

Run the example at `/examples/animation/`: Record, interact with OK, Stop, then
Replay or move the labelled time scrubber. The `<pre>` shows the sharable LiNo.
