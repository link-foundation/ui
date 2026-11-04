/** Production-warning assertions run in a process with its own environment. */
import assert from 'node:assert/strict';
import { createActionRegistry } from '../../packages/ui-react/src/actions.js';

assert.equal(process.env.NODE_ENV, 'production');
const messages = [];
const original = console.warn;
console.warn = (...args) => messages.push(args);
try {
  const registry = createActionRegistry();
  registry.setActions({});
  assert.equal(
    registry.dispatch({ source: 'ok', event: 'press', action: ['missing'] }),
    false
  );
  assert.deepEqual(messages, []);
  let calls = 0;
  registry.register('save', () => calls++);
  assert.equal(
    registry.dispatch({
      source: 'ok',
      event: 'press',
      action: ['emit', 'save'],
    }),
    true
  );
  assert.equal(calls, 1);
} finally {
  console.warn = original;
}
