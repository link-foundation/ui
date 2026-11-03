/**
 * Runs of the player: one animation on one element, and the control over a
 * set of runs that start together.
 *
 * Every function takes the player context:
 * `{ clock, animate, isCss, resolveToken, apply, seed, elementFor, motionOf }`.
 */

import { toWaapi } from './compile-waapi.js';
import { sampleLayers } from './layers.js';
import { sampleTyped } from './sample.js';
import { endTime, reducedMotionVariant } from './timing.js';
import { outputValue } from './values.js';

/** Write a non-CSS value on an element. */
export function defaultApply(element, property, value) {
  if (property === 'text') {
    element.textContent = String(value);
    return;
  }
  if (property === 'value' && 'value' in element) {
    element.value = value;
    return;
  }
  element.setAttribute(property, String(value));
}

function readOriginal(element, property) {
  if (property === 'text') {
    return element.textContent;
  }
  if (property === 'value' && 'value' in element) {
    return element.value;
  }
  return element.getAttribute(property);
}

function restoreOriginal(element, property, original) {
  if (property !== 'text' && property !== 'value' && original === null) {
    element.removeAttribute(property);
    return;
  }
  defaultApply(element, property, original);
}

function restoreAll(run) {
  for (const [property, original] of run.originals) {
    restoreOriginal(run.element, property, original);
  }
  run.originals.clear();
}

function abortError() {
  const message = 'The animation was cancelled';
  if (typeof globalThis.DOMException === 'function') {
    return new globalThis.DOMException(message, 'AbortError');
  }
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

/** The variant of an animation that plays on an element. */
export function variantFor(context, animation, element) {
  return context.motionOf(element) === 'reduced'
    ? reducedMotionVariant(animation)
    : animation;
}

/** Start the CSS tracks of a run on the Web Animations API. */
function startWaapi(context, variant, element, start) {
  const { keyframes, options: timing } = toWaapi(variant, {
    resolveToken: context.resolveToken,
    isCssProperty: context.isCss,
  });
  const delay = (timing.delay ?? 0) + start;
  if (delay !== 0) {
    timing.delay = delay;
  }
  const waapi = context.animate(element, keyframes, timing) ?? null;
  waapi?.finished?.catch?.(() => {});
  return waapi;
}

/**
 * One animation on one element, starting `start` ms after the play.
 * @param {object} context
 * @param {import('./types.js').Animation} animation
 * @param {Element|null} element
 * @param {number} start
 * @param {import('./types.js').PlayOptions} playOptions
 */
export function startRun(context, animation, element, start, playOptions) {
  const variant = variantFor(context, animation, element);
  const frameTracks = variant.tracks.filter((t) => !context.isCss(t.property));
  const hasCss = frameTracks.length < variant.tracks.length;
  const hasFrames =
    element !== null && (frameTracks.length > 0 || Boolean(variant.effect));
  let input = playOptions.input;
  if (hasFrames && input === undefined && variant.effect) {
    input = variant.effect.params.text ?? readOriginal(element, 'text');
  }
  return {
    animation: variant,
    frameAnimation: { ...variant, tracks: frameTracks },
    element,
    start,
    end: start + endTime(variant, context.resolveToken),
    waapi:
      element && hasCss ? startWaapi(context, variant, element, start) : null,
    hasFrames,
    originals: new Map(),
    seed: playOptions.seed ?? context.seed,
    input,
  };
}

/** Write the frame-loop values of a run at play time `t`. */
export function applyFrame(context, run, t) {
  if (!run.hasFrames) {
    return;
  }
  const { values, effects } = sampleTyped(run.frameAnimation, t - run.start, {
    resolveToken: context.resolveToken,
    seed: run.seed,
    input: run.input,
  });
  const written = { ...effects };
  for (const [property, value] of values) {
    written[property] = outputValue(value);
  }
  for (const [property, value] of Object.entries(written)) {
    if (!run.originals.has(property)) {
      run.originals.set(property, readOriginal(run.element, property));
    }
    context.apply(run.element, property, value);
  }
  // Without fill, a frame property goes back to its own value when the
  // run has no effect (before its delay or after its end).
  for (const [property, original] of run.originals) {
    if (!Object.hasOwn(written, property)) {
      restoreOriginal(run.element, property, original);
      run.originals.delete(property);
    }
  }
}

function deferred() {
  const out = {};
  out.promise = new Promise((resolve, reject) => {
    out.resolve = resolve;
    out.reject = reject;
  });
  return out;
}

/**
 * The control over a set of runs that start together.
 * @param {object} context
 * @param {object[]} runs
 * @returns {import('./index.js').PlayControl}
 */
export function createControl(context, runs) {
  const { clock } = context;
  const state = { startedAt: clock.now(), pausedAt: null, frame: null };
  let settled = false;
  let cancelled = false;
  const done = deferred();
  const end = Math.max(0, ...runs.map((r) => r.end));
  const elapsed = () =>
    state.pausedAt !== null ? state.pausedAt : clock.now() - state.startedAt;
  const stopFrames = () => {
    if (state.frame !== null) {
      clock.cancelFrame(state.frame);
      state.frame = null;
    }
  };

  const tick = () => {
    state.frame = null;
    if (settled || state.pausedAt !== null) {
      return;
    }
    const t = elapsed();
    for (const run of runs) {
      applyFrame(context, run, Math.min(t, run.end));
    }
    if (t >= end) {
      settled = true;
      done.resolve();
      return;
    }
    state.frame = clock.requestFrame(tick);
  };

  const finished = done.promise
    .then(() => Promise.all(runs.map((r) => r.waapi?.finished).filter(Boolean)))
    .then(() => undefined);
  finished.catch(() => {});

  const control = {
    finished,
    get currentTime() {
      return elapsed();
    },
    get runs() {
      return runs.map((r) => ({
        id: r.animation.id,
        element: r.element,
        start: r.start,
        end: r.end,
      }));
    },
    pause() {
      if (state.pausedAt !== null || settled) {
        return;
      }
      state.pausedAt = elapsed();
      runs.forEach((r) => r.waapi?.pause?.());
      stopFrames();
    },
    play() {
      if (state.pausedAt === null || settled) {
        return;
      }
      state.startedAt = clock.now() - state.pausedAt;
      state.pausedAt = null;
      runs.forEach((r) => r.waapi?.play?.());
      tick();
    },
    seek(ms) {
      if (settled) {
        return;
      }
      const t = Math.max(0, ms);
      if (state.pausedAt !== null) {
        state.pausedAt = t;
      } else {
        state.startedAt = clock.now() - t;
      }
      for (const run of runs) {
        if (run.waapi) {
          run.waapi.currentTime = t;
        }
        applyFrame(context, run, Math.min(t, run.end));
      }
    },
    cancel() {
      if (cancelled) {
        return;
      }
      cancelled = true;
      settled = true;
      stopFrames();
      for (const run of runs) {
        run.waapi?.cancel?.();
        restoreAll(run);
      }
      done.reject(abortError());
    },
    /**
     * The sampled values at the current time on `target` (default: the
     * target of the first run), all runs on it combined.
     */
    values(target) {
      const element =
        target === undefined ? runs[0]?.element : context.elementFor(target);
      const layers = runs
        .filter((r) => r.element === element)
        .map((r) => ({
          animation: r.animation,
          start: r.start,
          seed: r.seed,
          input: r.input,
        }));
      return sampleLayers(layers, elapsed(), {
        resolveToken: context.resolveToken,
      });
    },
  };
  tick();
  return control;
}
