/**
 * Batches store events into one patch per microtask: every transaction
 * committed in the same task is applied by a single `run(events)` call.
 */

/**
 * @template T
 * @param {(items: T[]) => void} run
 * @returns {{schedule(items: readonly T[]): void, flush(): number,
 *   cancel(): void}}
 */
export function createScheduler(run) {
  let queue = [];
  let pending = false;
  let cancelled = false;

  const flush = () => {
    if (queue.length === 0) {
      return 0;
    }
    const batch = queue;
    queue = [];
    run(batch);
    return batch.length;
  };

  return {
    schedule(items) {
      if (cancelled) {
        return;
      }
      for (const item of items) {
        queue.push(item);
      }
      if (!pending) {
        pending = true;
        globalThis.queueMicrotask(() => {
          pending = false;
          flush();
        });
      }
    },
    /** Apply the queued items now; returns how many there were. */
    flush,
    cancel() {
      cancelled = true;
      queue = [];
    },
  };
}
