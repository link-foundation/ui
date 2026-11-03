/**
 * Timing of an animation: resolving token durations, the active duration,
 * the Web Animations timing model (phases, iterations, direction, fill) and
 * the reduced-motion variant.
 */

import { easingFunction, spring } from './easing.js';
import { unwrapToken } from './tokens.js';

/** Properties that move, scale or reveal an element (not opacity/colour). */
export const MOVEMENT_PROPERTIES = Object.freeze([
  'transform',
  'translate',
  'scale',
  'rotate',
  'left',
  'top',
  'right',
  'bottom',
  'inset',
  'clip-path',
  'offset-distance',
  'offset-path',
  'background-position',
]);

export const isMovement = (property) => MOVEMENT_PROPERTIES.includes(property);

/**
 * A model time in ms: a number, or a `(token PATH)` resolved through
 * `resolveToken` (a ui-tokens duration such as `{ type: 'duration',
 * value: 150, unit: 'ms' }`, or a number of ms).
 * @returns {number|null} `null` when the token is unknown
 */
export function resolveTime(time, resolveToken) {
  if (typeof time === 'number') {
    return time;
  }
  if (time?.type !== 'token') {
    return null;
  }
  const value = unwrapToken(resolveToken?.(time.path));
  if (typeof value === 'number') {
    return value;
  }
  if (value?.type === 'duration') {
    return value.unit === 's' ? value.value * 1000 : value.value;
  }
  return null;
}

/**
 * The iteration duration of an animation (ms): its `duration`, else the
 * settle time of a spring easing, else 0.
 */
export function resolveDuration(animation, resolveToken) {
  const declared = resolveTime(animation.duration, resolveToken);
  if (declared !== null) {
    return declared;
  }
  if (animation.easing?.type === 'spring') {
    const { settleTime } = spring(animation.easing);
    return Number.isFinite(settleTime) ? settleTime : 0;
  }
  return 0;
}

/**
 * The resolved timing of an animation.
 * @param {import('./types.js').Animation} animation
 * @param {(path: string) => unknown} [resolveToken]
 */
export function resolveTiming(animation, resolveToken) {
  const duration = resolveDuration(animation, resolveToken);
  const delay = resolveTime(animation.delay ?? 0, resolveToken) ?? 0;
  const iterations = animation.iterations ?? 1;
  return {
    delay,
    duration,
    iterations,
    direction: animation.direction ?? 'normal',
    fill: animation.fill ?? 'none',
    easing: easingFunction(animation.easing, resolveToken),
    active: duration * iterations,
  };
}

/**
 * The time (ms) from the start of an animation to the end of its active
 * interval: `delay + duration * iterations` (Infinity for infinite).
 */
export function endTime(animation, resolveToken) {
  const { delay, active } = resolveTiming(animation, resolveToken);
  return delay + active;
}

const isReversed = (direction, iteration) => {
  switch (direction) {
    case 'reverse':
      return true;
    case 'alternate':
      return iteration % 2 === 1;
    case 'alternate-reverse':
      return iteration % 2 === 0;
    default:
      return false;
  }
};

/**
 * Where an animation is at local time `tMs` (the Web Animations timing
 * model): `null` when it has no effect (before or after it without fill),
 * else the iteration, the directed progress and the eased progress.
 * @param {ReturnType<typeof resolveTiming>} timing
 * @param {number} tMs
 * @returns {{ iteration: number, progress: number, eased: number, phase: 'before'|'active'|'after' }|null}
 */
export function timingAt(timing, tMs) {
  const { delay, duration, iterations, direction, fill, active } = timing;
  const local = tMs - delay;
  let phase = 'active';
  let overall;
  if (local < 0) {
    if (fill !== 'backwards' && fill !== 'both') {
      return null;
    }
    phase = 'before';
    overall = 0;
  } else if (local >= active) {
    if (fill !== 'forwards' && fill !== 'both') {
      return null;
    }
    phase = 'after';
    overall = iterations;
  } else {
    overall = duration > 0 ? local / duration : 0;
  }
  let iteration = Math.floor(overall);
  let progress = overall - iteration;
  if (phase === 'after' && progress === 0 && iterations > 0) {
    iteration -= 1;
    progress = 1;
  }
  const directed = isReversed(direction, iteration) ? 1 - progress : progress;
  return {
    iteration,
    progress: directed,
    eased: timing.easing(directed),
    phase,
  };
}

/**
 * The variant to play under reduced motion: the fields of the
 * `(reduced-motion ...)` block replace the animation's (its tracks, when it
 * has any, replace all tracks); without a block only the opacity tracks
 * stay, with duration 0 and one iteration.
 * @param {import('./types.js').Animation} animation
 * @returns {import('./types.js').Animation}
 */
export function reducedMotionVariant(animation) {
  const base = { ...animation, reducedMotion: null };
  if (animation.reducedMotion) {
    return { ...base, ...animation.reducedMotion };
  }
  return {
    ...base,
    duration: 0,
    iterations: 1,
    tracks: animation.tracks.filter((t) => t.property === 'opacity'),
  };
}
