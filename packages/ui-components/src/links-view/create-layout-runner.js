/**
 * One worker per active key. Termination interrupts synchronous heavy layouts,
 * and releases its memory immediately.
 * Every request carries both a key and a monotonically increasing job ID.
 */
export function createLayoutRunner({ createWorker } = {}) {
  const factory =
    createWorker ??
    (() =>
      new globalThis.Worker(
        new globalThis.URL(
          '../../dist/network-layout.worker.mjs',
          import.meta.url
        ),
        { type: 'module' }
      ));
  const active = new Map();
  let sequence = 0;
  let disposed = false;
  const abort = () =>
    Object.assign(new Error('Layout cancelled'), { name: 'AbortError' });
  const cancel = (key) => {
    const entry = active.get(key);
    if (!entry) {
      return;
    }
    active.delete(key);
    entry.worker.terminate();
    entry.reject(abort());
  };
  return {
    run(key, job) {
      cancel(key);
      if (disposed) {
        return Promise.reject(abort());
      }
      return new Promise((resolve, reject) => {
        const worker = factory();
        const id = ++sequence;
        const entry = { worker, reject, id };
        active.set(key, entry);
        const finish = (error, result) => {
          if (active.get(key) !== entry) {
            return;
          }
          active.delete(key);
          worker.terminate();
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        };
        worker.addEventListener('message', ({ data }) => {
          if (data.key !== key || data.id !== id) {
            return;
          }
          finish(data.error ? new Error(data.error) : null, {
            positions: new Map(data.positions),
            ticks: data.ticks,
          });
        });
        worker.addEventListener('error', (error) =>
          finish(new Error(error.message || 'Layout worker failed'))
        );
        try {
          worker.postMessage({ key, id, job });
        } catch (error) {
          finish(error);
        }
      });
    },
    cancel,
    dispose() {
      disposed = true;
      for (const key of active.keys()) {
        cancel(key);
      }
    },
  };
}
