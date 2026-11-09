import { playVoice } from './graph.js';
import { audioSession } from './audio-session.js';
import {
  bound,
  chooseVoices,
  configureRuntime,
  runtimeSettings,
} from './runtime.js';
import { runtimeFromConfig } from './settings.js';

function trackGestures(target, state, session, update) {
  const pointer = (event) => {
    if (Number.isFinite(event.clientX)) {
      update((event.clientX / Math.max(1, target.innerWidth ?? 1)) * 2 - 1);
    }
  };
  const gesture = (event) => {
    update();
    session.retry();
    pointer(event);
    if (state.enabled) {
      session.ensure();
    }
  };
  target?.addEventListener('pointerdown', gesture, true);
  target?.addEventListener('keydown', gesture, true);
  target?.addEventListener('pointermove', pointer, true);
  return () => {
    target?.removeEventListener('pointerdown', gesture, true);
    target?.removeEventListener('keydown', gesture, true);
    target?.removeEventListener('pointermove', pointer, true);
  };
}

function voiceScheduler({
  state,
  theme,
  random,
  session,
  position,
  isActivated,
}) {
  return (names, level, options) => {
    if (!state.enabled || state.volume <= 0 || !isActivated()) {
      return [];
    }
    const context = session.ensure();
    if (!context) {
      return [];
    }
    const detune =
      state.pitchSpread === 0 ? 0 : (random() * 2 - 1) * state.pitchSpread;
    const variation =
      state.pitchSpread === 0
        ? 1
        : 1 + (random() * 2 - 1) * 0.1 * Math.min(1, state.pitchSpread / 15);
    for (const name of names) {
      try {
        playVoice(context.audio, theme.voices[name], context.bus.input, {
          pan: position(options),
          random,
          detune,
          gain: (level * variation) / Math.sqrt(names.length),
        });
      } catch (error) {
        session.report(error);
      }
    }
    return names;
  };
}

/** Lazy opt-in player. Pre-activation plays are silent and never queued. */
export function createSoundPlayer({
  theme,
  config,
  now = () => globalThis.performance.now(),
  random = Math.random,
  createContext = () => new globalThis.AudioContext(),
  gestureTarget = globalThis.window,
  document = gestureTarget?.document ?? globalThis.document,
  hasBeenActive = () =>
    globalThis.navigator?.userActivation?.hasBeenActive === true,
  reducedMotion = () =>
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
    false,
  reducedMotionEvents = ['intro', 'scan'],
  maxVolume = 1,
  onDiagnostic = () => {},
} = {}) {
  const state = runtimeSettings(theme, bound(maxVolume, 1, 2, 1));
  state.reducedMotionEvents = [...reducedMotionEvents];
  configureRuntime(state, runtimeFromConfig(config, theme), theme);
  let disposed = false;
  let activated = false;
  let pan = 0;
  const listeners = new Set();
  const last = new Map();
  const turns = new Map();
  const previous = new Map();
  const session = audioSession({
    theme,
    state,
    createContext,
    random,
    onDiagnostic,
    document,
  });
  const stopGestures = trackGestures(gestureTarget, state, session, (value) => {
    if (value === undefined) {
      activated = true;
    } else {
      pan = bound(value, -1, 1);
    }
  });
  const configure = (values = {}) => {
    if (disposed) {
      return;
    }
    configureRuntime(state, values, theme);
    session.apply();
  };
  const stopConfig = config?.subscribe(() =>
    configure(runtimeFromConfig(config, theme))
  );
  const position = (options) =>
    state.stereo
      ? (Number.isFinite(options.x) ? bound(options.x * 2 - 1, -1, 1) : pan) *
        state.width
      : 0;
  const schedule = voiceScheduler({
    state,
    theme,
    random,
    session,
    position,
    isActivated: () => activated || hasBeenActive(),
  });
  const play = (event, options = {}) => {
    const binding = Object.hasOwn(state.events, event)
      ? state.events[event]
      : null;
    if (
      disposed ||
      !binding ||
      (state.reducedMotionEvents.includes(event) && reducedMotion())
    ) {
      return [];
    }
    const time = now();
    if (time - (last.get(event) ?? -Infinity) < binding.throttle) {
      return [];
    }
    // Unactivated cues may still drive visual feedback, but do not consume throttles.
    for (const listener of [...listeners]) {
      listener({ event, pan: position(options) });
    }
    if (!binding.voices.length) {
      return [];
    }
    const turn = turns.get(event) ?? 0;
    const chosen = chooseVoices(
      binding,
      state.mode ?? binding.mode,
      turn,
      previous.get(event),
      random
    );
    const played = schedule(chosen, binding.level, options);
    if (played.length) {
      last.set(event, time);
      turns.set(event, turn + 1);
      previous.set(event, chosen.at(-1));
    }
    return played;
  };
  return {
    play,
    cue: play,
    configure,
    preview(name, options = {}) {
      return disposed || !Object.hasOwn(theme.voices, name)
        ? []
        : schedule([name], 1, options);
    },
    onCue(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
    setVolume(value) {
      configure({ volume: bound(value, 0, state.maxVolume) });
      config?.set('sound.volume', state.volume);
    },
    mute(value = true) {
      configure({ enabled: !value });
      config?.set('sound.enabled', state.enabled);
    },
    get enabled() {
      return state.enabled;
    },
    get volume() {
      return state.volume;
    },
    get hoverGap() {
      return state.hoverGap;
    },
    async dispose() {
      disposed = true;
      stopGestures();
      stopConfig?.();
      listeners.clear();
      await session.dispose();
    },
  };
}
