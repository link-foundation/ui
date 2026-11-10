// Does the runtime's node:test abort t.signal on timeout, and is the child reaped?
// Run: node --test experiments/issue-246/signal-probe.test.mjs
//      deno test -A experiments/issue-246/signal-probe.test.mjs
//      bun test experiments/issue-246/signal-probe.test.mjs
import { test } from 'node:test';
import { spawn } from 'node:child_process';

const started = Date.now();
const log = (m) => console.error(`[probe] ${m}: ${Date.now() - started}ms`);
test('times out while a child sleeps', { timeout: 500 }, async (t) => {
  log(`signal ${t.signal ? 'present' : 'missing'}`);
  t.signal?.addEventListener('abort', () => log('signal aborted'));
  const child = spawn('node', ['-e', 'setTimeout(() => {}, 15000)'], {
    signal: t.signal,
  });
  child.on('error', (e) => log(`child error ${e.name}`));
  await new Promise((resolve) =>
    child.on('close', (code, sig) => {
      log(`child close code=${code} signal=${sig}`);
      resolve();
    })
  );
});
test('next test', () => log('next test started'));
