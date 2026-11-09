/**
 * Wrap a solver in a cancellable job. A supplied worker entry must install the
 * same solver with installSolverWorker. Without a worker URL or Worker support,
 * invoke the solver on this thread; synchronous CPU work cannot be interrupted.
 * Each worker handles exactly one request and is terminated on every exit path.
 *
 * @template Result
 * @param {function(Array, object, {signal: AbortSignal}): Result | Promise<Result>} solve
 * @param {{workerUrl?: string | URL, Worker?: typeof globalThis.Worker}} [configuration]
 */
export function createSolverJob(solve, configuration = {}) {
  const Worker = Object.hasOwn(configuration, 'Worker')
    ? configuration.Worker
    : globalThis.Worker;
  return (links, options = {}, { signal } = {}) =>
    new Promise((resolve, reject) => {
      let worker;
      let finished = false;
      const finish = (error, result) => {
        if (finished) {
          return;
        }
        finished = true;
        signal?.removeEventListener('abort', abort);
        if (worker) {
          worker.removeEventListener('message', message);
          worker.removeEventListener('error', failure);
          worker.removeEventListener('messageerror', failure);
          worker.terminate();
        }
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      };
      const fail = (error) =>
        finish(error instanceof Error ? error : new Error(String(error)));
      const abort = () =>
        finish(
          Object.assign(new Error('Solver cancelled'), { name: 'AbortError' })
        );
      const failure = (event) =>
        finish(new Error(event.message || 'Solver worker failed'));
      const message = ({ data }) => {
        if (data?.error) {
          finish(
            Object.assign(new Error(data.error.message), {
              name: data.error.name,
            })
          );
        } else if (data && Object.hasOwn(data, 'result')) {
          finish(null, data.result);
        } else {
          finish(new Error('Invalid solver worker response'));
        }
      };
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener('abort', abort, { once: true });
      try {
        // Match structured-clone isolation in both execution modes. AbortSignal
        // is a local control channel and is never sent through postMessage.
        const input = globalThis.structuredClone({ links, options });
        if (Worker && configuration.workerUrl) {
          worker = new Worker(configuration.workerUrl, { type: 'module' });
          worker.addEventListener('message', message);
          worker.addEventListener('error', failure);
          worker.addEventListener('messageerror', failure);
          worker.postMessage(input);
        } else {
          Promise.resolve(
            solve(input.links, input.options, {
              signal: signal ?? new AbortController().signal,
            })
          ).then(
            (result) => finish(null, result),
            (error) => fail(error)
          );
        }
      } catch (error) {
        fail(error);
      }
    });
}

/** Install in a module worker entry that imports the actual solver. */
export function installSolverWorker(scope, solve) {
  scope.addEventListener('message', async ({ data }) => {
    try {
      const result = await solve(data.links, data.options, {
        signal: new AbortController().signal,
      });
      scope.postMessage({ result });
    } catch (error) {
      scope.postMessage({
        error: {
          name: error?.name || 'Error',
          message: error?.message || String(error),
        },
      });
    }
  });
}
