/**
 * @link-foundation/ui-animation: animations written in Links Notation — a
 * declarative model of keyframe tracks, easings, springs, effects,
 * timelines and state triggers; a pure, seeded sampler; safety validators
 * (persistent fill, WCAG 2.3.1 flashes, reduced motion); a Web Animations
 * API compiler and a player. No GSAP; randomness is always seeded.
 */

export {
  loadAnimations,
  ANIMATION_STATES,
  ANIMATION_DEFAULTS,
} from './model.js';
export {
  NAMED_EASINGS,
  SPRING_TOLERANCE,
  isEasingName,
  linear,
  cubicBezier,
  steps,
  spring,
  springEasing,
  toCssLinear,
  easingFunction,
  easingCss,
} from './easing.js';
export { sample, sampleTyped, envelopeWeight } from './sample.js';
export { sampleLayers } from './layers.js';
export { seededRandom, seedNumber, hashString, mix } from './random.js';
export { registerEffect, getEffect, effectNames } from './effects.js';
export {
  decipher,
  revealOrder,
  decipherFrame,
  DECIPHER_CHARACTERS,
} from './effects/decipher.js';
export {
  validateAnimation,
  validateAnimations,
  luminanceChanges,
  PERSIST_PROPERTIES,
  FLASH_PROPERTIES,
  FLASH_LIMITS,
} from './validate.js';
export {
  toWaapi,
  keyframeProperty,
  isCssProperty,
  NON_CSS_PROPERTIES,
} from './compile-waapi.js';
export { flattenTimeline } from './timeline.js';
export {
  MOVEMENT_PROPERTIES,
  resolveTiming,
  timingAt,
  endTime,
  reducedMotionVariant,
} from './timing.js';
export {
  readValue,
  interpolate,
  valueCss,
  relativeLuminance,
} from './values.js';
export { tokenResolver } from './tokens.js';
export { createPlayer, defaultMotion, triggersFor } from './player.js';
export { createManualClock, systemClock, FRAME_MS } from './clock.js';

export { parseRecording, serializeRecording } from './recorder/format.js';
export { createRecorder } from './recorder/recorder.js';
export { stateAt, animationsAt } from './recorder/state-at.js';
export { replay } from './recorder/replay.js';
export { verifyReplay } from './recorder/verify.js';
export { toPlaywright } from './recorder/to-playwright.js';
