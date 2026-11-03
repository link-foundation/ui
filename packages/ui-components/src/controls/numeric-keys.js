/**
 * The keys of the numeric controls (`slider`, `number-field`), DOM-free:
 * `nextValue(key, state)` is the value a key moves to, and `clampStep`
 * keeps a value inside its range and on its step grid.
 *
 * | Key                      | Change                          |
 * | ------------------------ | ------------------------------- |
 * | ArrowUp, ArrowRight      | one step up (×10 with Shift)    |
 * | ArrowDown, ArrowLeft     | one step down (×10 with Shift)  |
 * | PageUp, PageDown         | ten steps (×10 with Shift)      |
 * | Home, End                | the minimum, the maximum        |
 *
 * In a right-to-left horizontal slider (`rtl: true`) ArrowRight steps
 * down and ArrowLeft steps up, as the track runs the other way.
 */

/** How many steps PageUp and PageDown move. */
export const PAGE_STEPS = 10;

/** How much Shift multiplies a step. */
export const SHIFT_FACTOR = 10;

/** The number of decimals of a finite number (`0.25` → 2, `1e-7` → 7). */
export function decimalsOf(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const [mantissa, exponent] = String(value).toLowerCase().split('e');
  const fraction = mantissa.split('.')[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponent ?? 0));
}

const finite = (value, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** A positive step; anything else is 1. */
const stepOf = (step) => (finite(step, 0) > 0 ? step : 1);

/**
 * Round `value` to the nearest multiple of `step` from `min` (or 0) and
 * clamp it to `[min, max]`. A bound that is not a finite number is open.
 * The result has no more decimals than the step and the minimum, so
 * `clampStep(0.1 + 0.2, {step: 0.1})` is `0.3`.
 * @param {number} value
 * @param {{min?: number, max?: number, step?: number}} [range]
 * @returns {number}
 */
export function clampStep(value, range = {}) {
  const min = finite(range.min, -Infinity);
  const max = finite(range.max, Infinity);
  const step = stepOf(range.step);
  const base = Number.isFinite(min) ? min : 0;
  const start = finite(value, base);
  const digits = Math.min(
    20,
    Math.max(decimalsOf(step), decimalsOf(Number.isFinite(min) ? min : 0))
  );
  const rounded = Number(
    (base + Math.round((start - base) / step) * step).toFixed(digits)
  );
  if (rounded > max) {
    return max;
  }
  return rounded < min ? min : rounded;
}

/** The step multiple of each stepping key (before Shift). */
const STEPS = Object.freeze({
  ArrowUp: 1,
  ArrowRight: 1,
  ArrowDown: -1,
  ArrowLeft: -1,
  PageUp: PAGE_STEPS,
  PageDown: -PAGE_STEPS,
});

/**
 * The value a key moves a numeric control to; `null` for a key that does
 * not change the value (the caller lets it through).
 * @param {string} key  a `KeyboardEvent.key`
 * @param {{value?: number, min?: number, max?: number, step?: number,
 *   shift?: boolean, rtl?: boolean}} state  `value` NaN (an empty field)
 *   starts from the minimum, else 0
 * @returns {number|null}
 */
export function nextValue(key, state = {}) {
  const range = { min: state.min, max: state.max, step: state.step };
  if (key === 'Home') {
    return Number.isFinite(state.min) ? state.min : null;
  }
  if (key === 'End') {
    return Number.isFinite(state.max) ? state.max : null;
  }
  if (!Object.hasOwn(STEPS, key)) {
    return null;
  }
  let multiple = STEPS[key];
  if (state.rtl === true && (key === 'ArrowLeft' || key === 'ArrowRight')) {
    multiple = -multiple;
  }
  if (state.shift === true) {
    multiple *= SHIFT_FACTOR;
  }
  const base = Number.isFinite(state.min) ? state.min : 0;
  const value = clampStep(finite(state.value, base), range);
  return clampStep(value + multiple * stepOf(state.step), range);
}
