// Does an aborted child emit exit/close, and how soon? (no test runner)
// Run: node experiments/issue-246/abort-close-probe.mjs
//      deno run -A experiments/issue-246/abort-close-probe.mjs
//      bun experiments/issue-246/abort-close-probe.mjs
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const started = Date.now();
const log = (m) => console.error(`[probe] ${m}: ${Date.now() - started}ms`);
const controller = new AbortController();
const build = promisify(execFile)(
  'node',
  ['-e', 'setTimeout(() => {}, 15000)'],
  {
    signal: controller.signal,
  }
);
build.child.on('exit', (code, signal) => log(`exit ${code} ${signal}`));
build.child.on('close', (code, signal) => log(`close ${code} ${signal}`));
build.catch((error) => log(`rejected ${error.name}`));
setTimeout(() => {
  log('abort');
  controller.abort();
}, 300);
const guard = setTimeout(() => log('no close within 5s'), 5000);
build.child.once('close', () => clearTimeout(guard));
