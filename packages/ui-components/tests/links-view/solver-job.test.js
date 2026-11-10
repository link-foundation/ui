import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSolverJob,
  installSolverWorker,
} from '../../src/links-view/solver-job.js';

function workerHarness() {
  const workers = [];
  class Worker extends globalThis.EventTarget {
    constructor(url, options) {
      super();
      this.url = url;
      this.options = options;
      this.terminated = false;
      workers.push(this);
    }
    postMessage(data) {
      this.request = globalThis.structuredClone(data);
    }
    terminate() {
      this.terminated = true;
    }
    message(data) {
      this.dispatchEvent(new globalThis.MessageEvent('message', { data }));
    }
  }
  return { Worker, workers };
}

it('runs the synchronous fallback with detached inputs and the caller signal', async () => {
  const links = [
    [2, 2],
    [1, 1],
  ];
  const options = { turns: [[0, 0]], gaps: [0.08, 0.08] };
  const signal = new AbortController().signal;
  const solve = createSolverJob(
    (copy, settings, context) => {
      assert.equal(context.signal, signal);
      copy[0][0] = 0;
      settings.turns[0][0] = 90;
      return { turns: settings.turns, count: copy.length };
    },
    { Worker: undefined, workerUrl: 'solver.mjs' }
  );
  assert.deepEqual(await solve(links, options, { signal }), {
    turns: [[90, 0]],
    count: 2,
  });
  assert.equal(links[0][0], 2);
  assert.equal(options.turns[0][0], 0);
});

it('uses a module worker and terminates it after receiving a result', async () => {
  const { Worker, workers } = workerHarness();
  const solve = createSolverJob(() => assert.fail('unexpected fallback'), {
    Worker,
    workerUrl: 'https://example.test/solver.mjs',
  });
  const pending = solve([[1, 1]], { passes: 3 });
  assert.deepEqual(workers[0].options, { type: 'module' });
  assert.deepEqual(workers[0].request, {
    links: [[1, 1]],
    options: { passes: 3 },
  });
  workers[0].message({ result: { before: 2, after: 1 } });
  assert.deepEqual(await pending, { before: 2, after: 1 });
  assert.equal(workers[0].terminated, true);
});

it('aborts immediately, terminates only that job, and ignores late results', async () => {
  const { Worker, workers } = workerHarness();
  const solve = createSolverJob(() => {}, { Worker, workerUrl: 'solver.mjs' });
  const controller = new AbortController();
  const first = solve([], {}, { signal: controller.signal });
  const rejected = assert.rejects(first, { name: 'AbortError' });
  const second = solve([], {});
  controller.abort();
  assert.equal(workers[0].terminated, true);
  assert.equal(workers[1].terminated, false);
  workers[0].message({ result: 'stale' });
  workers[1].message({ result: 'current' });
  await rejected;
  assert.equal(await second, 'current');
});

it('rejects already aborted calls without creating a worker or invoking fallback', async () => {
  const { Worker, workers } = workerHarness();
  const signal = AbortSignal.abort();
  for (const workerUrl of [undefined, 'solver.mjs']) {
    const solve = createSolverJob(() => assert.fail('unexpected fallback'), {
      Worker,
      workerUrl,
    });
    await assert.rejects(solve([], {}, { signal }), { name: 'AbortError' });
  }
  assert.equal(workers.length, 0);
});

it('rejects an asynchronous fallback on abort even when the backend ignores its signal', async () => {
  let complete;
  const solve = createSolverJob(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      })
  );
  const controller = new AbortController();
  const pending = solve([], {}, { signal: controller.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  controller.abort();
  await rejected;
  complete('late');
});

it('reports worker errors and terminates workers after failures', async () => {
  for (const type of ['error', 'messageerror', 'remote', 'clone']) {
    const { Worker, workers } = workerHarness();
    const solve = createSolverJob(() => assert.fail('unexpected fallback'), {
      Worker,
      workerUrl: 'solver.mjs',
    });
    if (type === 'clone') {
      Worker.prototype.postMessage = () => {
        throw new Error('cannot clone');
      };
    }
    const pending = solve([], {});
    if (type === 'remote') {
      workers[0].message({
        error: { name: 'RangeError', message: 'bad range' },
      });
    } else if (type !== 'clone') {
      workers[0].dispatchEvent(new globalThis.Event(type));
    }
    await assert.rejects(
      pending,
      type === 'remote'
        ? { name: 'RangeError', message: 'bad range' }
        : undefined
    );
    assert.equal(workers[0].terminated, true);
  }
});

it('installs the worker protocol without requiring renderer geometry', async () => {
  const requests = new globalThis.EventTarget();
  const replies = [];
  const scope = {
    addEventListener: (...args) => requests.addEventListener(...args),
    postMessage: (data) => replies.push(data),
  };
  installSolverWorker(scope, (links, options, { signal }) => {
    assert.equal(signal.aborted, false);
    if (options.fail) {
      throw new RangeError('invalid job');
    }
    return { links, options };
  });
  requests.dispatchEvent(
    new globalThis.MessageEvent('message', {
      data: { links: [[0, 0]], options: { passes: 3 } },
    })
  );
  await Promise.resolve();
  assert.deepEqual(replies, [
    { result: { links: [[0, 0]], options: { passes: 3 } } },
  ]);
  requests.dispatchEvent(
    new globalThis.MessageEvent('message', {
      data: { links: [], options: { fail: true } },
    })
  );
  await Promise.resolve();
  assert.deepEqual(replies[1], {
    error: { name: 'RangeError', message: 'invalid job' },
  });
});

it('preserves synchronous and asynchronous fallback failures, including non-Error throws', async () => {
  for (const backend of [
    () => {
      throw new RangeError('bad input');
    },
    () => Promise.reject(new RangeError('bad input')),
    () => Promise.reject(null),
  ]) {
    const solve = createSolverJob(backend, { Worker: undefined });
    await assert.rejects(solve([], {}), Error);
  }
});

it('cleans abort subscriptions on success and construction failure', async () => {
  for (const broken of [false, true]) {
    const { Worker, workers } = workerHarness();
    class BrokenWorker {
      constructor() {
        throw new Error('worker unavailable');
      }
    }
    const signal = new AbortController().signal;
    let subscriptions = 0;
    const add = signal.addEventListener.bind(signal);
    const remove = signal.removeEventListener.bind(signal);
    signal.addEventListener = (...args) => {
      subscriptions++;
      add(...args);
    };
    signal.removeEventListener = (...args) => {
      subscriptions--;
      remove(...args);
    };
    const solve = createSolverJob(() => {}, {
      Worker: broken ? BrokenWorker : Worker,
      workerUrl: 'solver.mjs',
    });
    const pending = solve([], {}, { signal });
    if (broken) {
      await assert.rejects(pending, /worker unavailable/u);
    } else {
      workers[0].message({ result: undefined });
      assert.equal(await pending, undefined);
    }
    assert.equal(subscriptions, 0);
  }
});

it(
  'round-trips through an actual module worker and awaits its termination',
  { timeout: 5000 },
  async () => {
    const { Worker: Thread } = await import('node:worker_threads');
    const terminations = [];
    class ModuleWorker extends globalThis.EventTarget {
      constructor(url, options) {
        super();
        this.thread = new Thread(url, {
          ...options,
          resourceLimits: { maxOldGenerationSizeMb: 32 },
        });
        this.thread.on('message', (data) => {
          this.dispatchEvent(new globalThis.MessageEvent('message', { data }));
        });
        this.thread.on('error', (error) => {
          const event = new globalThis.Event('error');
          event.message = error.message;
          this.dispatchEvent(event);
        });
      }
      postMessage(data) {
        this.thread.postMessage(data);
      }
      terminate() {
        terminations.push(this.thread.terminate());
      }
    }
    const solve = createSolverJob(() => assert.fail('unexpected fallback'), {
      Worker: ModuleWorker,
      workerUrl: new globalThis.URL(
        '../../../../experiments/issue-228/solver-protocol.worker.mjs',
        import.meta.url
      ),
    });
    try {
      assert.deepEqual(await solve([[0, 0]], { passes: 3 }), {
        links: [[0, 0]],
        options: { passes: 3 },
        aborted: false,
      });
    } finally {
      await Promise.all(terminations);
    }
    assert.equal(terminations.length, 1);
  }
);
