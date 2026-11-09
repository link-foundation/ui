import { createQualityWatcher } from './effect-quality.js';

function makeEffect(draw, options) {
  const fps = options.fps ?? 60;
  if (!Number.isFinite(fps) || fps < 5 || fps > 60) {
    throw new RangeError('Effect fps must be between 5 and 60');
  }
  return {
    draw,
    fps,
    capped: options.fps !== undefined,
    watcher: createQualityWatcher(options),
    onQualityChange: options.onQualityChange ?? (() => {}),
    previous: null,
    lastDraw: null,
    invalid: false,
  };
}

function resetEffects(effects) {
  for (const effect of effects.values()) {
    effect.previous = null;
    effect.lastDraw = null;
    effect.watcher.reset();
  }
}

function drawEffect(effect, time, state, moving) {
  const gap = effect.previous === null ? 0 : time - effect.previous;
  effect.previous = moving ? time : null;
  if (moving && effect.watcher.feed(gap)) {
    effect.onQualityChange(effect.watcher.snapshot());
  }
  const shares = effect.watcher.snapshot();
  const sinceDraw = effect.lastDraw === null ? 0 : time - effect.lastDraw;
  const invalid = effect.invalid;
  if (
    !invalid &&
    (effect.capped || shares.fps < 1) &&
    effect.lastDraw !== null &&
    sinceDraw + 1e-7 < 1000 / (effect.fps * shares.fps)
  ) {
    return true;
  }
  effect.invalid = false;
  const elapsed =
    invalid || effect.lastDraw === null
      ? 0
      : Math.max(0, Math.min(0.25, sinceDraw / 1000));
  effect.lastDraw = moving ? time : null;
  return effect.draw(time, { ...state }, elapsed, shares) === true;
}

function watchInputs(options, set) {
  const cleanups = [];
  const listen = (source, event, update) => {
    if (!source) {
      return;
    }
    source.addEventListener(event, update);
    cleanups.push(() => source.removeEventListener(event, update));
    update();
  };
  if (options.watchVisibility) {
    const document = options.document ?? globalThis.document;
    listen(document, 'visibilitychange', () =>
      set({ visible: !document.hidden })
    );
  }
  if (options.watchReducedMotion) {
    const media = (
      options.matchMedia ?? globalThis.matchMedia?.bind(globalThis)
    )?.('(prefers-reduced-motion: reduce)');
    listen(media, 'change', () => set({ reducedMotion: media.matches }));
  }
  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

/** Opt-in scheduler with independent, monotonically decreasing effect quality. */
export function createEffectGovernor(options = {}) {
  const {
    requestFrame = (fn) => globalThis.requestAnimationFrame(fn),
    cancelFrame = (id) => globalThis.cancelAnimationFrame(id),
    onSound = () => {},
  } = options;
  let state = {
    motion: false,
    reducedMotion: false,
    visible: true,
    sound: false,
    volume: 0,
  };
  let pending = null;
  let disposed = false;
  const effects = new Map();
  const assertLive = () => {
    if (disposed) {
      throw new Error('Effect governor is disposed');
    }
  };
  const enabled = () =>
    !disposed &&
    state.visible &&
    (state.motion === 'on' ||
      ((state.motion === true || state.motion === 'auto') &&
        !state.reducedMotion));
  const cancel = () => {
    if (pending !== null) {
      cancelFrame(pending);
      pending = null;
    }
  };
  const hasWork = () =>
    !disposed &&
    effects.size &&
    (enabled() || [...effects.values()].some((effect) => effect.invalid));
  const schedule = () => {
    if (pending === null && hasWork()) {
      pending = requestFrame(tick);
    }
  };
  function tick(time) {
    pending = null;
    for (const [id, effect] of effects) {
      const moving = enabled();
      if (disposed || (!moving && !effect.invalid)) {
        continue;
      }
      const keep = drawEffect(effect, time, state, moving);
      if (moving && !keep && effects.get(id) === effect) {
        effects.delete(id);
      }
    }
    schedule();
  }
  function set(patch) {
    assertLive();
    const next = { ...state, ...patch };
    if (!Number.isFinite(next.volume) || next.volume < 0 || next.volume > 1) {
      throw new RangeError('Sound volume must be between zero and one');
    }
    if (![true, false, 'auto', 'on', 'off'].includes(next.motion)) {
      throw new TypeError('Motion must be boolean, auto, on or off');
    }
    const wasEnabled = enabled();
    state = next;
    if (wasEnabled !== enabled()) {
      resetEffects(effects);
    }
    if (!hasWork()) {
      cancel();
    }
    schedule();
  }
  const unwatch = watchInputs(options, set);
  return {
    set,
    add(id, draw, effectOptions = {}) {
      assertLive();
      const effect = makeEffect(draw, effectOptions);
      effects.set(id, effect);
      schedule();
      return () => {
        if (effects.get(id) === effect) {
          effects.delete(id);
        }
        if (!hasWork()) {
          cancel();
        }
      };
    },
    getQuality(id) {
      return effects.get(id)?.watcher.snapshot();
    },
    invalidate(id) {
      assertLive();
      const effect = effects.get(id);
      if (effect) {
        effect.invalid = true;
        schedule();
      }
    },
    sound(event) {
      if (!disposed && state.visible && state.sound && state.volume > 0) {
        onSound(event, state.volume);
      }
    },
    dispose() {
      disposed = true;
      unwatch();
      cancel();
      effects.clear();
    },
  };
}
