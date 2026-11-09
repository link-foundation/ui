# Sound themes

`@link-foundation/ui-sound` reads one `sound-theme NAME` using the official
Links Notation reader through ui-core. It returns `{theme, diagnostics}`;
invalid input returns `theme: null`. Unknown keys, missing provenance,
unknown voice references, duplicate event/voice names, invalid choices and
out-of-range numbers are errors. Input is bounded to 128 KiB and depth 32.

```lino
sound-theme quiet
  voice tick
    oscillator triangle
      frequency 880
    envelope
      attack 0.002
      decay 0.04
      sustain 0
      release 0.02
    gain 0.02
    source
      label 'own work'
      license CC0-1.0
  event click
    mode random
    voices tick
  event scan
    throttle 120
  bus
    shelf 4000 -6
    compressor -18 4
    reverb 0.15
```

A voice contains either one graph directly or up to eight `part` clauses.
Each part has an `oscillator WAVE` (sine, triangle, square, sawtooth) or
`noise`, plus optional `envelope`, `gain` (0–1), `delay` (seconds, 0–10),
`pan` (-1–1), `detune` (cents, -4800–4800), and
`filter TYPE FROM TO Q`. Filter types are Web Audio biquad types; frequencies
are 1–24000 Hz and Q is 0.0001–100. Oscillators accept `frequency HZ`,
`glide TO SECONDS`, and `fm RATIO INDEX` (0.001–100 and 0–100).
Frequencies sweep exponentially; an omitted glide duration uses the envelope
length. A voice can repeat 1–8 times with `repeat`, `gap` (0–10 seconds) and
`repeat-decay` (0–1, gain multiplier per repeat).

Envelopes default to attack 0.004, decay 0.08, sustain 0, release 0.01.
Attack/decay/release are 0–10 seconds; sustain is a level from 0–1.
The gain starts at zero, reaches the peak after attack, reaches the sustain
level after decay, and releases immediately to **exact zero** after release.
There is no indefinite sustain or key-up phase. `curve exponential` uses a
0.0001 floor during decay (bounded by the peak) before the final linear
release; this preserves the immortality patches' decays. All scheduled
sources stop at the envelope end and disconnect their transient nodes.

Every voice has a `source` containing `label` and `license`, optionally
`character`, `url` and `port`. `url` is the original design reference;
`port` identifies the code being ported. The immortality theme preserves
all 26 SOUNDS records' character, sourceLabel (as label), and sourceUrl
(as url), alongside the Unlicense and immutable port revision. References
are metadata only: no third-party recordings or audio files are fetched.

An `event NAME` selects up to six voice names with `voices` and a `mode`:
`random` picks one using the injected random source, excluding the previously
played voice for the same event when another voice is available, `cycle` rotates, and
`layer` plays all with gain divided by the square root of the voice count.
An empty voice list is silent. `throttle` is milliseconds (0–60000), defaults
to 120 for scan and zero otherwise. The first cue is eligible at any clock
value; the next is eligible when the elapsed time is at least the throttle.

The bus defaults to `shelf 4000 -6`, `compressor -18 4`, `reverb 0.2`.
Shelf is Hz and dB (-40–40); compressor is threshold dB (-100–0) and ratio
(1–20). Input feeds a high shelf, then dry and convolution reverb paths,
then the compressor and a final master volume. Reverb is a 0–1 send to a
synthesized stereo impulse (default length 1.4 seconds). The wet route is
always present, including at send zero. Live volume/shelf/send changes use
a 20 ms time constant; room changes (0.3–4 seconds) replace the impulse in place. Mute and volume affect wet tails too.

## Interaction and comfort

A player starts disabled. An enabled player creates an AudioContext lazily
on a captured pointerdown/keydown or its first eligible play when the page
already has sticky user activation. `hasBeenActive` is injectable and defaults
to `navigator.userActivation.hasBeenActive`. Pre-activation cues stay silent
and are not queued. Enabling and playing in the same captured gesture works.
Failed initialization retries on the next gesture and reports optional
diagnostics. Hidden documents suspend audio immediately; the next eligible
visible play resumes it. Disposal removes the visibility listener too.

`play(event, {x})` and `cue(name, {x})` use a normalized horizontal
coordinate (0 left, 1 right). Without x the player uses the last pointermove or pointerdown
position; keyboard cues keep that position. Pointer pan is multiplied by
width (default 0.6), or zero while stereo is off. Part pan is then added and clamped.
`onCue` receives `{event, pan}` after throttling, including while muted,
so visual resonance can work independently. Unknown events, disposed
players and reduced-motion intro/scan events emit no cue. The injectable
clock returns milliseconds and random returns a number in [0,1).

Only `intro` and `scan` are suppressed by prefers-reduced-motion; unrelated
click and other interaction sounds remain available. Sound never carries
information unavailable through ordinary accessible UI. The viewer can
always mute and set a 0–1 volume (hosts may opt into a maximum up to 2).
The reduced-motion event list is configurable; its default remains intro/scan.

`SOUND_SETTINGS_LINO` declares `sound.enabled` (false) and `sound.volume`
(0.5) with ui-settings `(comfort)`. `bindSoundConfig` binds these fields to
the `settings` element's **user** layer in ui-config. Persist that layer
using ui-config `persistUserLayer`. Use the comfort fields in the host
schema for `applyPreset`, `applySharedLook`, share imports and `randomize`;
those operations preserve the viewer's values. Raw config patches remain
intentional edits, so do not import someone else's look as a raw user patch.
`SOUND_COMFORT_KEYS` is the package's explicit list; configuration-level
metadata is tracked in [#169](https://github.com/link-foundation/ui/issues/169)
as requested by #74 when #18 has no flag.

## Framework mapping

`bindSound(player, {machines, mapping})` returns `{onAction, dispose}`.
Pass `onAction` to ui-dom `mountDocument` or `mountBehavior`. The callback
observes the merged #33 renderer/registry route without replacing actions;
multiple actions for the same native event produce one sound. `machines`
contains actual #33 services: subscriptions map the triggering event of
accepted transitions. Use a single route for an interaction to avoid two
independent bindings playing it twice. Rejected machine events are silent.

The mapping is one LiNo `sound-map` with `FROM TO` clauses:

```lino
sound-map
  press click
  activate click
  hover hover
  toggle toggle
  change toggle
  select select
  open open
  close close
  type type
  scan scan
  intro intro
  notify notify
```

Invalid mapping input throws at binding setup. `dispose()` unsubscribes
machines and disables the callback. Await player `dispose()` to remove
gesture/config listeners, disconnect the bus and close its context.

## Runtime settings and document binding

The [ui-sound API guide](../../packages/ui-sound/README.md#live-controls-and-preview)
specifies runtime bounds, humanization, event replacement, preview and the
settings fragment. Runtime events accept zero to four ordered voice names,
mode, level (0–2, default 1) and throttle without reparsing a theme. Existing
theme files continue to accept up to six voices. A global mode overrides all
event modes. Layering applies 1/√n headroom before the event level.

Humanization defaults to ±15 cents and up to ±10% level, with level spread
scaled by min(1, cents/15). Zero spread yields exact added detune 0 and level 1.
Noise buffers are reused per context/sample rate with independent start offsets.
Every amplitude envelope has an explicit zero anchor before its scheduled
start, including fractional-sample repeat times.

The settings generator emits nested LiNo using ui-core `formatLinks`; every
field is comfort metadata. Sequential slots use `visible-when` clauses,
voice labels use `option-labels`, and previews use the existing panel hook.
The [document binding contract](../../packages/ui-sound/README.md#plain-document-interaction-binding)
defines control classification, disabled behavior, pointer entry and scan,
input throttles, details toggle deduplication and the window cue channel.
