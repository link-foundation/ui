import { createSoundBus, playVoice } from './graph.js';

const boundedVolume = (value) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

function chooseVoices(binding, turn, random) {
  const names = binding.voices;
  if (binding.mode === 'layer') {
    return [...names];
  }
  const index =
    binding.mode === 'cycle'
      ? turn % names.length
      : Math.min(
          names.length - 1,
          Math.max(0, Math.floor(random() * names.length))
        );
  return [names[index]];
}

function reportAudioError(onDiagnostic, error) {
  onDiagnostic({
    code: 'audio-unavailable',
    severity: 'warning',
    message: String(error?.message ?? error),
  });
}
function resumeAudio(audio, report) {
  if (audio?.state === 'suspended') {
    try {
      Promise.resolve(audio.resume()).catch(report);
    } catch (error) {
      report(error);
    }
  }
}

function pointerPan(x, target) {
  return Math.max(
    -1,
    Math.min(1, (x / Math.max(1, target.innerWidth ?? 1)) * 2 - 1)
  );
}

function listenGestures(target, gesture, pointer) {
  target?.addEventListener('pointerdown', gesture, true);
  target?.addEventListener('keydown', gesture, true);
  target?.addEventListener('pointermove', pointer, true);
  return () => {
    target?.removeEventListener('pointerdown', gesture, true);
    target?.removeEventListener('keydown', gesture, true);
    target?.removeEventListener('pointermove', pointer, true);
  };
}

/**
 * Silent until enabled and a pointerdown/keydown. `config` is the sound settings
 * binding returned by bindSoundConfig (or a compatible get/set/subscribe store).
 * `x` is a normalized pointer coordinate, 0 left to 1 right.
 */
export function createSoundPlayer({
  theme,
  config,
  now = () => globalThis.performance.now(),
  random = Math.random,
  createContext = () => new globalThis.AudioContext(),
  gestureTarget = globalThis.window,
  reducedMotion = () =>
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
    false,
  onDiagnostic = () => {},
} = {}) {
  let enabled = config?.get('sound.enabled') === true;
  let volume = boundedVolume(config?.get('sound.volume') ?? 0.5);
  let audio = null;
  let bus = null;
  let disposed = false;
  let activated = false;
  let pan = 0;
  const listeners = new Set();
  const last = new Map();
  const turns = new Map();
  const report = (error) => reportAudioError(onDiagnostic, error);
  const applyVolume = () => {
    if (bus) {
      bus.master.gain.setValueAtTime(enabled ? volume : 0, audio.currentTime);
    }
  };
  const resume = () => resumeAudio(audio, report);
  const gesture = (event) => {
    if (disposed) {
      return;
    }
    activated = true;
    if (Number.isFinite(event.clientX)) {
      pan = pointerPan(event.clientX, gestureTarget);
    }
    if (!enabled) {
      return;
    }
    try {
      if (!audio) {
        audio = createContext();
        bus = createSoundBus(audio, theme.bus, random);
        applyVolume();
      }
      resume();
    } catch (error) {
      bus?.disconnect();
      const failed = audio;
      audio = bus = null;
      try {
        Promise.resolve(failed?.close?.()).catch(report);
      } catch {
        /* reported below */
      }
      report(error);
    }
  };
  const stopGestures = listenGestures(gestureTarget, gesture, (event) => {
    if (Number.isFinite(event.clientX)) {
      pan = pointerPan(event.clientX, gestureTarget);
    }
  });
  const stopConfig = config?.subscribe(() => {
    enabled = config.get('sound.enabled') === true;
    volume = boundedVolume(config.get('sound.volume'));
    applyVolume();
  });
  const canPlay = () => activated && audio && enabled && volume > 0;
  const play = (event, options = {}) => {
    if (disposed) {
      return [];
    }
    const binding = theme.events[event];
    if (!binding || (['intro', 'scan'].includes(event) && reducedMotion())) {
      return [];
    }
    const time = now();
    if (time - (last.get(event) ?? -Infinity) < binding.throttle) {
      return [];
    }
    last.set(event, time);
    const position = Number.isFinite(options.x)
      ? Math.max(-1, Math.min(1, options.x * 2 - 1))
      : pan;
    for (const listener of [...listeners]) {
      listener({ event, pan: position });
    }
    if (!canPlay()) {
      return [];
    }
    resume();
    if (!binding.voices.length) {
      return [];
    }
    const turn = turns.get(event) ?? 0;
    const chosen = chooseVoices(binding, turn, random);
    turns.set(event, turn + 1);
    for (const name of chosen) {
      try {
        playVoice(audio, theme.voices[name], bus.input, {
          pan: position,
          random,
          gain: 1 / Math.sqrt(chosen.length),
        });
      } catch (error) {
        report(error);
      }
    }
    return chosen;
  };
  return {
    play,
    cue: (name, options) => play(name, options),
    onCue(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
    setVolume(value) {
      volume = boundedVolume(value);
      config?.set('sound.volume', volume);
      applyVolume();
    },
    mute(value = true) {
      enabled = !value;
      config?.set('sound.enabled', enabled);
      applyVolume();
    },
    get enabled() {
      return enabled;
    },
    get volume() {
      return volume;
    },
    async dispose() {
      disposed = true;
      stopGestures();
      stopConfig?.();
      listeners.clear();
      bus?.disconnect();
      try {
        await audio?.close?.();
      } catch (error) {
        report(error);
      }
    },
  };
}
