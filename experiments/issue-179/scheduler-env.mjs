/**
 * Bounded Deno reproduction: a parallel worker changes the shared NODE_ENV
 * between scheduler's entry-point and development-module guards.
 * deno run -A --node-modules-dir=manual experiments/issue-179/scheduler-env.mjs
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { URL } from 'node:url';

const require = createRequire(
  new URL('../../packages/ui-react/package.json', import.meta.url)
);
const { JSDOM } = require('jsdom');
const React = require('react');
const dom = new JSDOM('<div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const state = new Int32Array(new SharedArrayBuffer(4));
const worker = new globalThis.Worker(
  URL.createObjectURL(
    new globalThis.Blob(
      [
        `
    onmessage = ({ data }) => {
      const state = new Int32Array(data);
      const before = Deno.env.get('NODE_ENV');
      for (const [request, response, mode] of [[1, 2, 'production'], [3, 4, before]]) {
        if (Atomics.load(state, 0) !== request) Atomics.wait(state, 0, request - 1, 5000);
        if (Atomics.load(state, 0) !== request) throw Error('worker handshake failed');
        if (mode === undefined) Deno.env.delete('NODE_ENV');
        else Deno.env.set('NODE_ENV', mode);
        Atomics.store(state, 0, response);
        Atomics.notify(state, 0);
      }
    };
  `,
      ],
      { type: 'text/javascript' }
    )
  ),
  { type: 'module' }
);
worker.postMessage(state.buffer);
function exchange(request, response) {
  Atomics.store(state, 0, request);
  Atomics.notify(state, 0);
  Atomics.wait(state, 0, request, 5000);
  assert.equal(Atomics.load(state, 0), response, 'worker handshake');
}
const original = process.env;
const before = original.NODE_ENV;
let intercepted = false;
try {
  process.env = new Proxy(original, {
    get(target, key) {
      if (
        key === 'NODE_ENV' &&
        new Error().stack.includes('scheduler.development.js')
      ) {
        intercepted = true;
        exchange(1, 2);
        const value = Reflect.get(target, key);
        console.log('scheduler development guard sees worker NODE_ENV:', value);
        exchange(3, 4);
        return value;
      }
      return Reflect.get(target, key);
    },
  });
  const { createRoot } = require('react-dom/client');
  process.env = original;
  const scheduler = require('scheduler');
  console.log(
    'versions:',
    require('react/package.json').version,
    require('react-dom/package.json').version,
    require('scheduler/package.json').version
  );
  console.log('scheduler exports:', Object.keys(scheduler));
  assert.equal(intercepted, true);
  assert.equal(scheduler.unstable_now, undefined);
  assert.throws(
    () =>
      createRoot(dom.window.document.getElementById('root')).render(
        React.createElement('p', null, 'Hello')
      ),
    /now is not a function/
  );
  console.log('Reproduced ReactDOMRoot.render: now is not a function');
} finally {
  process.env = original;
  worker.terminate();
  if (before === undefined) {
    delete original.NODE_ENV;
  } else {
    original.NODE_ENV = before;
  }
  dom.window.close();
}
