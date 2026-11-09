# @link-foundation/ui-sound

Opt-in UI sound synthesized with Web Audio from Links Notation themes.
No audio files, network requests or import-time browser effects.

```js
import {
  readSoundTheme,
  createSoundPlayer,
  bindSoundConfig,
  bindSound,
} from '@link-foundation/ui-sound';
import { createConfig, persistUserLayer } from '@link-foundation/ui-config';
import { parse } from '@link-foundation/ui-core';

// Load this bundled text using your host's file loader or fetch:
// @link-foundation/ui-sound/themes/quiet.lino
const { theme, diagnostics } = readSoundTheme(themeText);
if (!theme) throw new Error(diagnostics.map((d) => d.message).join('\n'));
const config = createConfig({ document: parse('settings: box') });
const persistence = persistUserLayer(config, localStorage);
const settings = bindSoundConfig(config);
const player = createSoundPlayer({ theme, config: settings });
const binding = bindSound(player);
// Pass binding.onAction to ui-dom mountDocument or #33 mountBehavior.
// Enable only in response to the viewer's explicit choice:
settings.set('sound.enabled', true);
player.setVolume(0.3);
// Audio initializes lazily when the page has user activation.
player.play('click', { x: 0.5 });
player.cue('open');
const unsubscribe = player.onCue(({ event, pan }) => drawResonance(event, pan));
player.mute(); // persists sound.enabled = false
player.mute(false); // persists sound.enabled = true
// On unmount:
unsubscribe();
binding.dispose();
await player.dispose();
persistence.stop();
```

`createSoundPlayer` accepts `{theme, config, now, random, createContext,
gestureTarget, document, hasBeenActive, maxVolume, reducedMotion,
reducedMotionEvents, onDiagnostic}`. Only theme is required. The
optional config has `get`, `set`, `subscribe` as provided by
`bindSoundConfig`. Without it, volume/mute live in memory and sound starts
off. `mute(false)` enables it. `now` returns milliseconds; `random` returns
[0,1). Inject these and `createContext` for deterministic tests. Browser
failures reach `onDiagnostic`; it defaults to no logging. The player exposes
read-only `enabled` and `volume`. `play` returns the selected voice names
or an empty array when silent. `cue` is its public event-name alias.

A theme has named voices (oscillator/noise graphs, envelopes, optional
filters/FM/delays/repeats), event modes `random`, `cycle`, `layer`, per-event
throttling, a shelf/compressor/reverb bus, and per-voice provenance.
[The specification](../../docs/spec/sound.md) defines all fields and bounds.
`createSoundBus(context, settings, random)` and
`playVoice(context, voice, output, options)` also accept an offline or fake
BaseAudioContext directly. `playVoice` returns the scheduled end time.

Bundled themes are `quiet` (five soft voices) and `immortality` (all 26
patches, including noise, FM and stereo parts). The port is from
[konard/immortality at 16a6172](https://github.com/konard/immortality/tree/16a6172c38fc120133485f805c49d980b9850bc4)
under the Unlicense. Every source record retains the original character,
source label and reference URL from SOUNDS in settings.ts. Those references
identify inspiration, not downloaded assets; only synthesized code is
ported. The quiet theme is original CC0-1.0 work. Reproduce the port with
[the experiment script](../../experiments/issue-74/port.mjs).

`bindSound` maps #33 `press` to `click`, `open` to `open`, etc. It accepts
a LiNo `sound-map` override and optional interpreter `machines`. Pass its
`onAction` callback to the existing renderer; it deduplicates multiple
actions per native event. Machine subscriptions map accepted transition
events. Bind each interaction through one route. Call `dispose` on both
binding and player when unmounting.

Sound is off by default and audio never starts before a user gesture.
Respect the viewer's choice: include `SOUND_SETTINGS_LINO` comfort fields
in your settings schema (`soundSettingsSchema()` returns the standalone
schema; merge fields into the host schema without a second schema header).
Use ui-settings preset/shared-look/randomize functions before updating the
config user layer. `SOUND_COMFORT_KEYS` exports the explicit key list.
Never copy sound preferences from another viewer's raw config patch.
Persist the user layer to keep volume on reload. Only motion-linked intro
and scan cues respect reduced motion; all other sounds follow the viewer's
sound preference. Keep visual/text/ARIA equivalents for all information,
and make mute and volume available through accessible host controls.

```bash
node --test packages/ui-sound/tests/*.test.js
```

## Live controls and preview

`player.configure(values)` updates settings in memory without creating or
replacing the AudioContext. Fields are `volume` (0–1), `tone` (high-shelf dB,
−40–40), `frequency` (1–24000 Hz), `reverb` (0–1), `room` (0.3–4 seconds),
`pitchSpread` (0–100 cents), `stereo`, `width` (0–1), `hoverGap` (0–500 ms),
`mode` (`random`, `cycle`, `layer`, or `null` to use event modes), and `enabled`.
Pass `maxVolume: 2` at player construction and schema generation to opt into
200% volume; the default maximum is 1. `setVolume` and `mute` persist through
config; `configure` is transient. Config changes apply generated settings live.

```js
player.configure({
  frequency: 3200,
  tone: -7, // warm; neutral 0, bright +5
  reverb: 0.5,
  room: 2,
  pitchSpread: 15,
  stereo: true,
  width: 0.6,
  events: {
    activate: {
      voices: ['tick', 'tap'],
      mode: 'cycle',
      level: 2,
      throttle: 70,
    },
  },
});
player.preview('tick');
```

An event update replaces each supplied property, preserves omitted properties,
and leaves other events unchanged. Runtime lists contain zero to four known
voices; an empty list is silent. Invalid lists/modes throw at configuration.
Random selection excludes the last played voice for the same event. Layering
retains 1/√n headroom before the event level (0–2, default 1).

Each play shares one uniform detune within ±pitchSpread and a uniform level
variation up to ±10%, scaled by min(1, spread/15). Spread zero gives exactly
zero added detune and unity level. Defaults are 15 cents, stereo on, width 0.6.
Pointer pan is multiplied by width before part pan is added and clamped;
stereo off removes pointer pan while retaining part pan.

The bus exposes `shelf`, `wet`, `convolver` and `configure` in addition to
`input`, `master`, `disconnect`. Volume, shelf gain/frequency and send changes
use a 20 ms time constant. The wet route exists at initial reverb zero; changing
room replaces the impulse buffer in place. Noise uses a weakly held two-second
buffer per context/sample rate, looped from an independent random offset.
Envelopes stay exactly zero before delayed/repeated scheduled starts.

`preview(voiceName, {x})` bypasses event mapping, throttle and reduced-motion
event suppression; it still respects activation, enabled, volume, stereo,
humanization and the bus. Unknown voices are silent. The page visibility
listener suspends hidden audio; the next eligible visible play resumes it.
`hasBeenActive` defaults to `navigator.userActivation.hasBeenActive`. A lazily
created player can play immediately after sticky activation; pre-activation
plays never create audio or queue sounds. A captured gesture also unlocks a
subsequent enable-and-play in that same handler. Failed initialization retries
on a new gesture and reports through the existing opt-in diagnostics.
`reducedMotionEvents` (also configurable at runtime) defaults to `['intro', 'scan']`.

## Generated settings

`generateSoundSettings(theme, events, {slots: 4, maxVolume: 1})` returns a
nested LiNo fragment without a schema header. Append it to a host schema, or
use `createSoundSettingsSchema` for a standalone schema. Event entries are
names or `{name, label}` objects. `slots` is 1–4. The voice name `none` is
reserved in generated settings. Choice values remain voice names, with labels
from `source.character` (falling back to the name). `option-labels` metadata
is rendered by the standard settings panel. Global keys are `sound.enabled`,
`sound.volume`, `sound.mode`, `sound.tone`, `sound.reverb`, `sound.room`,
`sound.pitchSpread`, `sound.stereo`, `sound.width`, `sound.hoverGap`.
Tone choices are warm/neutral/bright; programmatic tone uses dB.

Event keys are `sound.events.EVENT.voice1` through `voice4` and
`sound.events.EVENT.level`. Slot n+1 is visible when n is not `none`;
playback stops reading slots at the first `none`. Room is visible only when
reverb is positive; width only while stereo is on. Every generated field is
comfort metadata, so presets, shared looks and randomization preserve it.
`SOUND_COMFORT_KEYS` lists the global keys; use `schema.fields` to enumerate
all generated event keys. The existing two-field `SOUND_SETTINGS_LINO` and
`soundSettingsSchema()` remain available for basic mute/volume consumers.

Pass `{schema}` to `bindSoundConfig(config, {schema})` to bind all generated
fields. The player subscribes to these fields, including consumer-only events.
The settings panel's `mountPreview` hook can call `player.preview(values[field.key])`
for fields marked `preview sound-voice`. See the complete, runnable
[settings example](examples/README.md), including accessible ▶ buttons.

## Plain document interaction binding

`bindSoundToDocument(player, {root: document, cueEvent: 'sound-cue', now})`
installs one set of capture listeners and returns `{dispose}`. `root` may also
be an element. Use this route once for controls outside ui-dom action binding.

- Mouse hover cues once on entry to an interactive control, throttled by the
  player's live hover gap (default 80 ms). Touch and pen do not hover.
- Clicks cue `toggle` for checkboxes/pressed buttons, `select` for radios/tabs,
  and `activate` for other buttons/links. An ancestor `data-sound="NAME"`
  overrides classification; an empty value silences it.
- Summary clicks defer to the details `toggle` event, which cues `open`/`close`.
- Range input cues `select` every 70 ms; text input/textarea cues `type` every
  30 ms; select/colour changes cue `select`.
- Pointer movement within `data-sound-scan` cues `scan` every 90 ms.
- Disabled, aria-disabled and inert controls are silent.

Components can dispatch `new CustomEvent('sound-cue', {detail: 'notify'})` on
window, or use `detail: {event: 'notify', x: 0.5}`. Set `cueEvent` to your
channel name (empty disables it). The binder uses injectable milliseconds
and removes all document/window listeners on disposal.
