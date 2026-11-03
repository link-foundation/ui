/**
 * `validateAnimation(animation)`: the safety rules of an animation.
 *
 * - `persistent-fill` (error): `(fill both)` or `(fill forwards)` on a
 *   clip-path, transform, translate, scale or rotate track keeps the final
 *   value on the element after the animation ends (immortality issue-7,
 *   R19), unless the animation says `(persist true)`.
 * - `flash` (error): WCAG 2.3.1 Three Flashes or Below Threshold. The
 *   opacity, background-color and color tracks are sampled at 60 Hz; a flash
 *   is a pair of opposing changes of relative luminance of 0.1 or more where
 *   the darker side is below 0.8; more than 3 flashes in any one-second
 *   window is an error (immortality issue-7, R20).
 * - `missing-reduced-motion` (warning): a movement track that runs for more
 *   than 0 ms without a `(reduced-motion ...)` block.
 */

import { animationDiagnostic } from './diagnostics.js';
import { sampleTyped } from './sample.js';
import { endTime, isMovement, resolveTiming } from './timing.js';
import { relativeLuminance } from './values.js';

/** Tracks whose final value must not persist without `(persist true)`. */
export const PERSIST_PROPERTIES = Object.freeze([
  'clip-path',
  'transform',
  'translate',
  'scale',
  'rotate',
]);

/** Tracks whose luminance changes are checked for flashes. */
export const FLASH_PROPERTIES = Object.freeze([
  'opacity',
  'background-color',
  'color',
]);

/** WCAG 2.3.1 thresholds. */
export const FLASH_LIMITS = Object.freeze({
  maxFlashes: 3,
  minChange: 0.1,
  darkerBelow: 0.8,
  sampleRate: 60,
  windowMs: 1000,
});

/** How long an infinite animation is sampled for flashes (ms). */
const INFINITE_SPAN = 3000;
/** The longest finite span that is sampled (ms), to bound the work. */
const MAX_SPAN = 60000;

function checkFill(animation) {
  if (animation.persist || !['both', 'forwards'].includes(animation.fill)) {
    return [];
  }
  return animation.tracks
    .filter((track) => PERSIST_PROPERTIES.includes(track.property))
    .map((track) =>
      animationDiagnostic('persistent-fill', 'error', {
        element: animation.id,
        track: track.property,
        fill: animation.fill,
      })
    );
}

/** The luminance (0..1) of a sampled flash-track value, or `null`. */
function luminanceOf(property, value) {
  if (value === undefined) {
    return null;
  }
  if (property === 'opacity') {
    // Opacity is the worst case: a white layer over black.
    return value.type === 'number'
      ? Math.min(1, Math.max(0, value.value))
      : null;
  }
  return value.type === 'color' ? relativeLuminance(value.color) : null;
}

/**
 * The times (ms) of the luminance changes of a series: a change is a swing
 * of at least `minChange` from the last extreme, and counts only when its
 * darker side is below `darkerBelow`.
 * @param {{ t: number, l: number }[]} series
 */
export function luminanceChanges(series, limits = FLASH_LIMITS) {
  const changes = [];
  if (series.length === 0) {
    return changes;
  }
  let direction = 0;
  let low = series[0].l;
  let high = series[0].l;
  for (const { t, l } of series) {
    if (direction >= 0 && l > high) {
      high = l;
    }
    if (direction <= 0 && l < low) {
      low = l;
    }
    const rose = l - low >= limits.minChange && direction <= 0;
    const fell = high - l >= limits.minChange && direction >= 0;
    if (rose || fell) {
      const darker = rose ? low : l;
      if (darker < limits.darkerBelow) {
        changes.push(t);
      }
      direction = rose ? 1 : -1;
      low = l;
      high = l;
    }
  }
  return changes;
}

/** The most changes in any window of `windowMs`. */
function maxInWindow(times, windowMs) {
  let most = 0;
  let start = 0;
  for (let end = 0; end < times.length; end++) {
    while (times[end] - times[start] >= windowMs) {
      start++;
    }
    most = Math.max(most, end - start + 1);
  }
  return most;
}

function checkFlashes(animation, options) {
  const limits = { ...FLASH_LIMITS, ...options.flash };
  const tracks = animation.tracks.filter((t) =>
    FLASH_PROPERTIES.includes(t.property)
  );
  if (tracks.length === 0) {
    return [];
  }
  const timing = resolveTiming(animation, options.resolveToken);
  if (!(timing.duration > 0)) {
    return [];
  }
  const end = endTime(animation, options.resolveToken);
  const span = Math.min(
    Number.isFinite(end) ? end : timing.delay + INFINITE_SPAN,
    MAX_SPAN
  );
  const step = 1000 / limits.sampleRate;
  const series = new Map(tracks.map((t) => [t.property, []]));
  for (let i = 0; i * step <= span; i++) {
    const t = i * step;
    const { values } = sampleTyped(animation, t, options);
    for (const [property, points] of series) {
      const l = luminanceOf(property, values.get(property));
      if (l !== null) {
        points.push({ t, l });
      }
    }
  }
  const diagnostics = [];
  for (const [property, points] of series) {
    const changes = luminanceChanges(points, limits);
    const flashes = Math.floor(maxInWindow(changes, limits.windowMs) / 2);
    if (flashes > limits.maxFlashes) {
      diagnostics.push(
        animationDiagnostic('flash', 'error', {
          element: animation.id,
          track: property,
          flashes,
          limit: limits.maxFlashes,
        })
      );
    }
  }
  return diagnostics;
}

function checkReducedMotion(animation, options) {
  if (animation.reducedMotion) {
    return [];
  }
  const moving = animation.tracks.find((t) => isMovement(t.property));
  const { duration } = resolveTiming(animation, options.resolveToken);
  if (!moving || !(duration > 0)) {
    return [];
  }
  return [
    animationDiagnostic('missing-reduced-motion', 'warning', {
      element: animation.id,
      track: moving.property,
      duration,
    }),
  ];
}

/**
 * The safety diagnostics of one animation.
 * @param {import('./types.js').Animation} animation
 * @param {import('./types.js').ValidateOptions} [options]
 * @returns {import('./types.js').Diagnostic[]}
 */
export function validateAnimation(animation, options = {}) {
  return [
    ...checkFill(animation),
    ...checkFlashes(animation, options),
    ...checkReducedMotion(animation, options),
  ];
}

/**
 * The safety diagnostics of every animation of a model.
 * @param {import('./types.js').AnimationModel} model
 * @param {import('./types.js').ValidateOptions} [options]
 */
export function validateAnimations(model, options = {}) {
  return [...model.animations.values()].flatMap((a) =>
    validateAnimation(a, options)
  );
}
