/**
 * `sample(animation, tMs, options)`: the values of an animation at a time.
 * Pure and deterministic: the same animation, time and seed always give the
 * same values (effects use the seed, never the platform random generator).
 */

import { easingFunction } from './easing.js';
import { getEffect } from './effects.js';
import { resolveTiming, timingAt } from './timing.js';
import { interpolate, outputValue, resolveValue } from './values.js';

/** The neutral value of an additive animation of `property`. */
function neutral(property, value) {
  const identity = property === 'scale' ? 1 : 0;
  if (value.type === 'number') {
    return { type: 'number', value: identity };
  }
  if (value.type === 'text') {
    return {
      type: 'text',
      parts: value.parts.map((part) =>
        typeof part === 'object' ? { value: identity, unit: part.unit } : part
      ),
    };
  }
  return value;
}

/**
 * The value of one track at eased progress `p`: the segment of the keys
 * around `p`, with the easing of its first key. Progress outside 0..1 (an
 * overshooting easing) extrapolates the first or last segment, as WAAPI
 * does.
 */
function trackValue(track, p, resolveToken) {
  const keys = track.keys;
  if (keys.length === 1) {
    return resolveValue(keys[0].value, resolveToken);
  }
  let i = 0;
  while (i < keys.length - 2 && p >= keys[i + 1].offset) {
    i++;
  }
  const from = keys[i];
  const to = keys[i + 1];
  const first = keys[0];
  const last = keys[keys.length - 1];
  // Before the first key (or after the last) that is not at 0 (or 1) the
  // value holds; there is no underlying value to blend from.
  if (p < first.offset && first.offset > 0) {
    return resolveValue(first.value, resolveToken);
  }
  if (p > last.offset && last.offset < 1) {
    return resolveValue(last.value, resolveToken);
  }
  const span = to.offset - from.offset;
  if (span <= 0) {
    return resolveValue(p < to.offset ? from.value : to.value, resolveToken);
  }
  const local = (p - from.offset) / span;
  const inside = local >= 0 && local <= 1;
  const eased = inside
    ? easingFunction(from.easing, resolveToken)(local)
    : local;
  return interpolate(
    resolveValue(from.value, resolveToken),
    resolveValue(to.value, resolveToken),
    eased
  );
}

/**
 * The weight of an envelope at iteration progress `p` (0..1): `bell` is
 * sin²(πp); `sustain` rises with a smoothstep over the attack, holds 1 and
 * falls over the release (default 20% of the duration each).
 */
export function envelopeWeight(envelope, p, duration) {
  if (!envelope) {
    return 1;
  }
  if (envelope.type === 'bell') {
    return Math.sin(Math.PI * p) ** 2;
  }
  const fraction = (ms) =>
    ms === undefined || !(duration > 0) ? 0.2 : Math.min(1, ms / duration);
  const smooth = (x) => {
    const c = Math.min(1, Math.max(0, x));
    return c * c * (3 - 2 * c);
  };
  const attack = fraction(envelope.attack);
  const release = fraction(envelope.release);
  const rise = attack > 0 ? smooth(p / attack) : 1;
  const fall = release > 0 ? smooth((1 - p) / release) : 1;
  return Math.min(rise, fall);
}

/**
 * The typed values of an animation at `tMs` (used by `sample`,
 * `sampleLayers` and the validators).
 * @param {import('./types.js').Animation} animation
 * @param {number} tMs
 * @param {import('./types.js').SampleOptions} [options]
 */
export function sampleTyped(animation, tMs, options = {}) {
  const { resolveToken } = options;
  const timing = resolveTiming(animation, resolveToken);
  const at = timingAt(timing, tMs);
  const result = { active: at !== null, values: new Map(), effects: {} };
  if (at === null) {
    return result;
  }
  const weight = envelopeWeight(
    animation.envelope,
    at.progress,
    timing.duration
  );
  const additive = animation.composite && animation.composite !== 'replace';
  for (const track of animation.tracks) {
    if (track.keys.length === 0) {
      continue;
    }
    let value = trackValue(track, at.eased, resolveToken);
    if (weight !== 1) {
      const rest = additive
        ? neutral(track.property, value)
        : resolveValue(track.keys[0].value, resolveToken);
      value = interpolate(rest, value, weight);
    }
    result.values.set(track.property, value);
  }
  if (animation.effect) {
    const entry = getEffect(animation.effect.name);
    if (entry) {
      const { params } = animation.effect;
      const seed = params.seed ?? options.seed ?? 0;
      const input = options.input ?? params.text ?? '';
      result.effects[entry.property] = entry.fn(input, at.eased, seed, params);
    }
  }
  return result;
}

/**
 * The values of an animation at `tMs` ms after it starts (its delay
 * included): `{ scale: 0.96 }`, `{ translate: '0 4px' }`, `{ text: '...' }`.
 * Numbers are numbers, every other value is CSS text, effect outputs are
 * under their property. Empty when the animation has no effect at `tMs`
 * (before or after it without fill).
 * @param {import('./types.js').Animation} animation
 * @param {number} tMs
 * @param {import('./types.js').SampleOptions} [options]
 * @returns {Record<string, number|string|unknown>}
 */
export function sample(animation, tMs, options = {}) {
  const { values, effects } = sampleTyped(animation, tMs, options);
  const out = {};
  for (const [property, value] of values) {
    out[property] = outputValue(value);
  }
  return Object.assign(out, effects);
}
