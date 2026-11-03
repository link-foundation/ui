/**
 * `toWaapi(animation, { resolveToken })`: an animation as the arguments of
 * `element.animate(keyframes, options)` (Web Animations API).
 *
 * Keyframes are written per offset; a key easing becomes the `easing` of its
 * keyframe (WAAPI applies it to the segment that starts there), the
 * animation easing becomes `options.easing`. Values are CSS text
 * (`scale: '0.96'`). Tracks of non-CSS properties (`text`, ...) and effects
 * are left out: the player runs them in its frame loop. An animation with an
 * `(envelope ...)` is baked into sampled keyframes, since WAAPI has no
 * envelope.
 */

import { easingCss } from './easing.js';
import { sampleTyped } from './sample.js';
import { resolveDuration, resolveTime } from './timing.js';
import { resolveValue, valueCss } from './values.js';

/** Properties of UI elements that are not CSS: the frame loop runs them. */
export const NON_CSS_PROPERTIES = Object.freeze([
  'text',
  'label',
  'value',
  'title',
  'placeholder',
  'progress',
]);

/** Whether a track property is a CSS property WAAPI can animate. */
export const isCssProperty = (property) =>
  !NON_CSS_PROPERTIES.includes(property);

/** Keyframes sampled for an animation with an envelope. */
const BAKED_SAMPLES = 40;

/**
 * The WAAPI keyframe key of a CSS property: `background-color` ->
 * `backgroundColor`, `offset` -> `cssOffset`, `float` -> `cssFloat`; custom
 * properties (`--x`) stay as they are.
 */
export function keyframeProperty(property) {
  if (property.startsWith('--')) {
    return property;
  }
  if (property === 'offset' || property === 'float') {
    return `css${property[0].toUpperCase()}${property.slice(1)}`;
  }
  let out = '';
  for (let i = 0; i < property.length; i++) {
    const c = property[i];
    if (c === '-' && i + 1 < property.length) {
      i++;
      out += property[i].toUpperCase();
    } else {
      out += c;
    }
  }
  return out;
}

function trackKeyframes(tracks, resolveToken) {
  const frames = [];
  for (const track of tracks) {
    const name = keyframeProperty(track.property);
    for (const key of track.keys) {
      const css = key.easing ? easingCss(key.easing, resolveToken) : null;
      const easing = css === 'linear' ? null : css;
      let frame = frames.find(
        (f) =>
          f.offset === key.offset &&
          (f.easing ?? null) === easing &&
          !Object.hasOwn(f, name)
      );
      if (!frame) {
        frame = { offset: key.offset };
        if (easing) {
          frame.easing = easing;
        }
        frames.push(frame);
      }
      frame[name] = valueCss(resolveValue(key.value, resolveToken));
    }
  }
  return frames.sort((a, b) => a.offset - b.offset);
}

/** One iteration sampled into linear keyframes (iteration easing included). */
function bakedKeyframes(animation, tracks, duration, resolveToken) {
  const single = {
    ...animation,
    tracks,
    effect: null,
    delay: 0,
    iterations: 1,
    direction: 'normal',
    fill: 'both',
    duration,
  };
  const frames = [];
  for (let i = 0; i <= BAKED_SAMPLES; i++) {
    const offset = i / BAKED_SAMPLES;
    const { values } = sampleTyped(single, offset * duration, { resolveToken });
    const frame = { offset };
    for (const [property, value] of values) {
      frame[keyframeProperty(property)] = valueCss(value);
    }
    frames.push(frame);
  }
  return frames;
}

/**
 * @param {import('./types.js').Animation} animation
 * @param {{ resolveToken?: (path: string) => unknown,
 *   isCssProperty?: (property: string) => boolean }} [options]
 * @returns {{ keyframes: Record<string, string|number>[], options: Record<string, string|number> }}
 */
export function toWaapi(animation, options = {}) {
  const { resolveToken } = options;
  const css = options.isCssProperty ?? isCssProperty;
  const tracks = animation.tracks.filter(
    (t) => css(t.property) && t.keys.length > 0
  );
  const duration = resolveDuration(animation, resolveToken);
  const baked = Boolean(animation.envelope);
  const keyframes = baked
    ? bakedKeyframes(animation, tracks, duration, resolveToken)
    : trackKeyframes(tracks, resolveToken);
  const timing = {
    duration,
    easing: baked ? 'linear' : easingCss(animation.easing, resolveToken),
    fill: animation.fill ?? 'none',
    composite: animation.composite ?? 'replace',
  };
  const delay = resolveTime(animation.delay ?? 0, resolveToken) ?? 0;
  if (delay !== 0) {
    timing.delay = delay;
  }
  if ((animation.iterations ?? 1) !== 1) {
    timing.iterations = animation.iterations;
  }
  if ((animation.direction ?? 'normal') !== 'normal') {
    timing.direction = animation.direction;
  }
  return { keyframes, options: timing };
}
