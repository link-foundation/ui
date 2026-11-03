/**
 * Does an expired setTimeout(0) run before a microtask queued two hops
 * deep earlier in the same task? In a plain script: no, in Node and in
 * Deno (0/200 both). The radio-group flake of #34 needs jsdom's
 * MutationObserver, run from Deno's Node-compat tick drain; see
 * `radio-group-deno-flake.probe.mjs`.
 *
 *   deno run experiments/deno-timer-vs-microtask.mjs
 *   node experiments/deno-timer-vs-microtask.mjs
 */

let lost = 0;
const runs = 200;
for (let i = 0; i < runs; i++) {
  const log = [];
  const timer = new Promise((resolve) =>
    setTimeout(() => {
      log.push('timer');
      resolve();
    }, 0)
  );
  const start = Date.now();
  while (Date.now() - start < 2) {
    // Busy: the timer expires during this task.
  }
  Promise.resolve().then(() =>
    globalThis.queueMicrotask(() =>
      globalThis.queueMicrotask(() => log.push('deep microtask'))
    )
  );
  await timer;
  await new Promise((resolve) => setTimeout(resolve, 5));
  if (log[0] === 'timer') {
    lost++;
  }
}
console.log(`timer ran before the deep microtask in ${lost}/${runs} runs`);
