/**
 * Clocks of the player: the page clock (`performance.now()` and animation
 * frames) and a manual clock that only moves when told to, which makes
 * playback deterministic in tests and offline rendering.
 */

/** One frame at 60 Hz (ms). */
export const FRAME_MS = 1000 / 60;

/**
 * A clock that only moves when told to.
 * @param {number} [start]
 * @returns {import('./index.js').ManualClock}
 */
export function createManualClock(start = 0) {
  let now = start;
  let nextId = 1;
  const frames = new Map();
  const timers = new Map();
  const runFrames = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) {
      callback(now);
    }
  };
  return {
    now: () => now,
    requestFrame(callback) {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    },
    cancelFrame(id) {
      frames.delete(id);
    },
    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { at: now + Math.max(0, ms), callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    /** Move the time forward by `ms`, one frame (`step` ms) at a time. */
    advance(ms, step = FRAME_MS) {
      if (
        !Number.isFinite(ms) ||
        ms < 0 ||
        !Number.isFinite(step) ||
        step <= 0
      ) {
        throw new RangeError('Invalid clock advance');
      }
      const end = now + ms;
      do {
        const frameAt = Math.min(end, now + step);
        for (;;) {
          let due;
          for (const item of timers) {
            if (item[1].at <= frameAt && (!due || item[1].at < due[1].at)) {
              due = item;
            }
          }
          if (!due) {
            break;
          }
          timers.delete(due[0]);
          now = due[1].at;
          due[1].callback();
        }
        now = frameAt;
        runFrames();
      } while (now < end);
    },
    /** Pending frame callbacks. */
    get pending() {
      return frames.size + timers.size;
    },
  };
}

/** The clock of the page: `performance.now()` and animation frames. */
export function systemClock() {
  const raf = globalThis.requestAnimationFrame;
  return {
    now: () => globalThis.performance.now(),
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (id) => clearTimeout(id),
    requestFrame: raf
      ? (callback) => raf(callback)
      : (callback) =>
          setTimeout(() => callback(globalThis.performance.now()), FRAME_MS),
    cancelFrame: raf
      ? (id) => globalThis.cancelAnimationFrame(id)
      : (id) => clearTimeout(id),
  };
}
