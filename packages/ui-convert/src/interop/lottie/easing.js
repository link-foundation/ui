/**
 * Lottie keyframe easing <-> ui-dialect easing.
 *
 * A Lottie keyframe eases towards the next one with an out handle `o` and
 * an in handle `i` (`{ x, y }`, each a number or a per-dimension array), or
 * holds its value with `h: 1`. In LiNo a `(key ...)` link ends with
 * `(cubic-bezier ox oy ix iy)` or `hold`; a key without either takes the
 * `(easing <name>)` of its animation (see {@link NAMED_EASINGS}).
 */

import { isObject } from '../safety.js';
import { isNumber, isVector, num } from './shared.js';

/** Keyframe keys that hold the easing. */
export const EASING_KEYS = ['i', 'o', 'h'];

/**
 * The cubic-bezier of the ui-core easing names, for keys without their own
 * easing.
 */
export const NAMED_EASINGS = {
  linear: [0, 0, 1, 1],
  standard: [0.2, 0, 0, 1],
  emphasized: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0, 1],
  accelerate: [0.3, 0, 1, 1],
};

/**
 * One number of an easing handle component (a number, or an array whose
 * items are all equal), or `undefined`.
 * @param {unknown} component
 */
export function handle(component) {
  if (isNumber(component)) {
    return component;
  }
  if (isVector(component) && component.every((n) => n === component[0])) {
    return component[0];
  }
  return undefined;
}

/** Whether `i` and `o` are plain `{ x, y }` handles of single numbers. */
function plainHandles({ i, o }) {
  return (
    isObject(i) &&
    isObject(o) &&
    Object.keys(i).length === 2 &&
    Object.keys(o).length === 2 &&
    [o.x, o.y, i.x, i.y].every((c) => handle(c) !== undefined)
  );
}

/**
 * The easing link of a keyframe: `(cubic-bezier ox oy ix iy)`, `hold`, or
 * `null` when the easing cannot be written as either (it then stays in the
 * keyframe's extra).
 * @param {Record<string, unknown>} frame
 * @returns {string|string[]|null}
 */
export function readEasing(frame) {
  if (frame.h === 1 && !('i' in frame) && !('o' in frame)) {
    return 'hold';
  }
  if ('h' in frame || !plainHandles(frame)) {
    return null;
  }
  const { i, o } = frame;
  return ['cubic-bezier', ...[o.x, o.y, i.x, i.y].map((c) => num(handle(c)))];
}

/**
 * Lottie `o`/`i` handles of a cubic-bezier.
 * @param {number[]} points `[ox, oy, ix, iy]`
 */
export const bezierHandles = ([ox, oy, ix, iy]) => ({
  o: { x: ox, y: oy },
  i: { x: ix, y: iy },
});

/**
 * The Lottie keys of an easing link (`hold` or `(cubic-bezier ...)`), or
 * `null` for any other link.
 * @param {unknown} part
 * @param {(raw: unknown) => number|undefined} number Reads a number atom.
 */
export function writeEasing(part, number) {
  if (part === 'hold') {
    return { h: 1 };
  }
  if (Array.isArray(part) && part[0] === 'cubic-bezier') {
    return bezierHandles(part.slice(1).map(number));
  }
  return null;
}

/**
 * Collapse easing handles whose components are all equal into numbers, in
 * place (the normal form of `normalizeLottie`).
 * @param {Record<string, unknown>} frame
 */
export function collapseEasing(frame) {
  if (plainHandles(frame)) {
    for (const h of [frame.i, frame.o]) {
      h.x = handle(h.x);
      h.y = handle(h.y);
    }
  }
}
