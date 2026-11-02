/**
 * Change listeners: every committed transaction calls each listener once
 * with all its events. A listener that throws is reported to `onError` and
 * does not stop the others. A commit made by a listener is delivered after
 * the current batch has reached every listener, so all listeners see the
 * batches in the same order.
 */

import { check } from './errors.js';

/** @param {unknown} error */
export const reportToConsole = (error) => {
  console.error('ui-store: a change listener threw', error);
};

/**
 * @param {(error: unknown, info: object) => void} onError
 */
export function createEmitter(onError = reportToConsole) {
  /** @type {Set<Function>} */
  const listeners = new Set();
  /** Batches waiting while listeners run. */
  const pending = [];
  let emitting = false;

  function deliver(events, entry) {
    for (const listener of [...listeners]) {
      try {
        listener(events, entry);
      } catch (error) {
        try {
          onError(error, { listener, events, entry });
        } catch {
          // A failing error reporter must not break the store either.
        }
      }
    }
  }

  return {
    /** Call `listener(events, entry)`; returns the unsubscribe function. */
    subscribe(listener) {
      check(typeof listener === 'function', 'bad-op', 'listener: function');
      const own = (events, entry) => listener(events, entry);
      listeners.add(own);
      return () => listeners.delete(own);
    },
    emit(events, entry) {
      pending.push([events, entry]);
      if (emitting) {
        return;
      }
      emitting = true;
      try {
        while (pending.length > 0) {
          deliver(...pending.shift());
        }
      } finally {
        emitting = false;
      }
    },
  };
}
