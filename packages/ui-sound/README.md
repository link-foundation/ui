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
// On the next pointerdown or keydown, audio initializes lazily.
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
gestureTarget, reducedMotion, onDiagnostic}`. Only theme is required. The
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
