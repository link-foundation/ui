/** Runtime normalization is shared by config updates and explicit configure. */
export const bound = (value, min, max, fallback = min) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export const MODES = ['random', 'cycle', 'layer'];

export function runtimeSettings(theme, maxVolume) {
  return {
    enabled: false,
    volume: 0.5,
    maxVolume,
    tone: theme.bus.shelf[1],
    frequency: theme.bus.shelf[0],
    reverb: theme.bus.reverb,
    room: theme.bus.room ?? 1.4,
    pitchSpread: 15,
    stereo: true,
    width: 0.6,
    hoverGap: 80,
    mode: null,
    reducedMotionEvents: ['intro', 'scan'],
    events: Object.fromEntries(
      Object.entries(theme.events).map(([key, value]) => [
        key,
        { level: 1, ...value, voices: [...value.voices] },
      ])
    ),
  };
}

export function configureRuntime(state, values, theme) {
  for (const [key, min, max] of [
    ['volume', 0, state.maxVolume],
    ['tone', -40, 40],
    ['frequency', 1, 24000],
    ['reverb', 0, 1],
    ['room', 0.3, 4],
    ['pitchSpread', 0, 100],
    ['width', 0, 1],
    ['hoverGap', 0, 500],
  ]) {
    if (Object.hasOwn(values, key)) {
      state[key] = bound(values[key], min, max, state[key]);
    }
  }
  for (const key of ['enabled', 'stereo']) {
    if (typeof values[key] === 'boolean') {
      state[key] = values[key];
    }
  }
  if (values.mode === null || MODES.includes(values.mode)) {
    state.mode = values.mode;
  }
  if (Array.isArray(values.reducedMotionEvents)) {
    state.reducedMotionEvents = [...values.reducedMotionEvents];
  }
  for (const [event, changes] of Object.entries(values.events ?? {})) {
    const binding = configureEvent(
      Object.hasOwn(state.events, event) ? state.events[event] : undefined,
      changes,
      theme
    );
    Object.defineProperty(state.events, event, {
      value: binding,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
}

export function chooseVoices(binding, mode, turn, previous, random) {
  const names = binding.voices;
  if (mode === 'layer') {
    return [...names];
  }
  if (mode === 'cycle') {
    return [names[turn % names.length]];
  }
  const candidates =
    names.length > 1 ? names.filter((name) => name !== previous) : names;
  const pool = candidates.length ? candidates : names;
  return [
    pool[
      Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))
    ],
  ];
}

function configureEvent(initial, changes, theme) {
  if (!changes || typeof changes !== 'object') {
    throw new TypeError('Expected event settings');
  }
  const before = initial ?? {
    voices: [],
    mode: 'random',
    level: 1,
    throttle: 0,
  };
  const binding = { ...before };
  if (changes.voices !== undefined) {
    if (
      !Array.isArray(changes.voices) ||
      changes.voices.length > 4 ||
      changes.voices.some((name) => !Object.hasOwn(theme.voices, name))
    ) {
      throw new TypeError('Expected zero to four known voices');
    }
    binding.voices = [...changes.voices];
  }
  if (changes.mode !== undefined) {
    if (!MODES.includes(changes.mode)) {
      throw new TypeError('Unknown sound mode');
    }
    binding.mode = changes.mode;
  }
  if (changes.level !== undefined) {
    binding.level = bound(changes.level, 0, 2, 1);
  }
  if (changes.throttle !== undefined) {
    binding.throttle = bound(changes.throttle, 0, 60000);
  }

  return binding;
}
