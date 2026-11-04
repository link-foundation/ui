// Bounded cross-worker Windows handle-inheritance probe. Compare Node and Deno.
// Four rounds, four workers, at most eight small Node children at once. Every
// keeper exits after one second; an outer CI guard remains the final backstop.
import { spawn } from 'node:child_process';
import { URL } from 'node:url';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';

const rounds = 4;
const workers = 4;

function start(code, stdio) {
  const child = spawn('node', ['--max-old-space-size=32', '-e', code], {
    stdio,
  });
  for (const stream of child.stdio) {
    stream?.resume?.();
  }
  const started = Date.now();
  let exited;
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', () => {
      exited = Date.now() - started;
    });
    child.on('close', (code) => {
      resolve({ code, exited, closed: Date.now() - started });
    });
  });
  return done;
}

if (isMainThread) {
  const pool = Array.from(
    { length: workers },
    () => new Worker(new URL(import.meta.url))
  );
  try {
    for (let round = 0; round < rounds; round++) {
      const results = pool.map(
        (worker) =>
          new Promise((resolve, reject) => {
            worker.once('message', resolve);
            worker.once('error', reject);
          })
      );
      for (const worker of pool) {
        worker.postMessage(round);
      }
      console.log(
        JSON.stringify({ round, results: await Promise.all(results) })
      );
    }
  } finally {
    await Promise.all(pool.map((worker) => worker.terminate()));
  }
} else {
  parentPort.on('message', async () => {
    const probe = start('console.log("probe");', [
      'ignore',
      'pipe',
      'pipe',
      ...Array(64).fill('pipe'),
    ]);
    const keeper = start('setTimeout(() => {}, 1000);', 'ignore');
    parentPort.postMessage({ probe: await probe, keeper: await keeper });
  });
}
