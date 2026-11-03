/**
 * `createAnimator({now, raf})`: named animations on one frame loop. A frame
 * is requested only while an animation is running, so a view where nothing
 * moves costs no frames at all. With `prefers-reduced-motion: reduce` an
 * animation is not played: its function is called once, at once, with
 * `reduced: true`, and should jump to its final state.
 *
 * The clock and the frame scheduler are injected, so tests run without a
 * browser and without real time.
 */

/**
 * @typedef {object} Frame
 * @property {number} time  `now()` of this frame
 * @property {number} elapsed  since the animation started
 * @property {boolean} reduced  reduced motion: the only call, go to the end
 * @typedef {(frame: Frame) => boolean|void} Step  return `true` to be
 *   called again on the next frame; anything else ends the animation
 * @typedef {object} AnimatorOptions
 * @property {() => number} [now]
 * @property {(callback: (time: number) => void) => unknown} [raf]
 * @property {(handle: unknown) => void} [caf]
 * @property {() => boolean} [reducedMotion]  whether motion is reduced
 *   (default: the `prefers-reduced-motion: reduce` media query)
 * @property {(error: unknown, id: string) => void} [onError]  a step that
 *   throws ends its animation and is reported here (default: rethrown in a
 *   task)
 * @typedef {object} Animator
 * @property {(id: string, step: Step) => void} start  replaces a running
 *   animation of the same id
 * @property {(id: string) => boolean} stop
 * @property {(id?: string) => boolean} isRunning  one animation, or any
 * @property {() => void} destroy  stops everything
 */

const defaultNow = () => globalThis.performance?.now() ?? 0;

/** `requestAnimationFrame`, or a 16 ms timer where there is none. */
const defaultRaf = (callback) =>
  typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame(callback)
    : setTimeout(() => callback(defaultNow()), 16);

const defaultCaf = (handle) =>
  typeof globalThis.cancelAnimationFrame === 'function'
    ? globalThis.cancelAnimationFrame(handle)
    : clearTimeout(handle);

/** Whether the user asked for reduced motion. */
export const prefersReducedMotion = (win = globalThis) =>
  win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

/**
 * Create an animator.
 * @param {AnimatorOptions} [options]
 * @returns {Animator}
 */
export function createAnimator(options = {}) {
  const now = options.now ?? defaultNow;
  const raf = options.raf ?? defaultRaf;
  const caf = options.caf ?? defaultCaf;
  const reducedMotion = options.reducedMotion ?? (() => prefersReducedMotion());
  const onError =
    options.onError ??
    ((error) =>
      setTimeout(() => {
        throw error;
      }, 0));
  /** @type {Map<string, {step: Step, started: number}>} */
  const active = new Map();
  let handle = null;
  let destroyed = false;

  const schedule = () => {
    if (handle === null && active.size > 0 && !destroyed) {
      handle = raf(tick);
    }
  };

  function tick() {
    handle = null;
    const time = now();
    for (const [id, entry] of [...active]) {
      // An animation stopped by an earlier one in this frame is skipped.
      if (active.get(id) !== entry) {
        continue;
      }
      let more = false;
      try {
        more =
          entry.step({
            time,
            elapsed: time - entry.started,
            reduced: false,
          }) === true;
      } catch (error) {
        // A failing animation ends; the others keep running.
        onError(error, id);
      }
      if (!more && active.get(id) === entry) {
        active.delete(id);
      }
    }
    schedule();
  }

  const unschedule = () => {
    if (handle !== null && active.size === 0) {
      caf(handle);
      handle = null;
    }
  };

  return {
    start(id, step) {
      if (destroyed) {
        return;
      }
      if (typeof step !== 'function') {
        throw new TypeError('animator.start: the step must be a function');
      }
      if (reducedMotion()) {
        active.delete(id);
        unschedule();
        const time = now();
        step({ time, elapsed: 0, reduced: true });
        return;
      }
      active.set(id, { step, started: now() });
      schedule();
    },
    stop(id) {
      const had = active.delete(id);
      unschedule();
      return had;
    },
    isRunning: (id) => (id === undefined ? active.size > 0 : active.has(id)),
    destroy() {
      active.clear();
      unschedule();
      destroyed = true;
    },
  };
}
