// The readers of the devmode and React examples read the nested texts of
// #133 like the parenthesized ones they replace.
// Run: node experiments/issue-133/check-example-readers.mjs
import assert from 'node:assert/strict';
import { parseDevModePolicy } from '../../packages/ui-devmode/src/policy.js';
import { parse } from '@link-foundation/ui-core';

// The policy is frozen; compare it as plain data.
const policy = (text) => JSON.parse(JSON.stringify(parseDevModePolicy(text)));
assert.deepEqual(
  policy('(site-dev-mode: dev-mode (enabled false))'),
  policy('site-dev-mode: dev-mode\n  enabled false')
);
assert.deepEqual(
  policy(`(site-dev-mode: dev-mode
        (enabled true)
        (entry shortcut url-parameter element)
        (shortcut 'Alt+Shift+D')
        (write-layers session user)
        (locked-elements payment-form))`),
  policy(`site-dev-mode: dev-mode
  enabled true
  entry shortcut url-parameter element
  shortcut 'Alt+Shift+D'
  write-layers session user
  locked-elements payment-form`)
);
const roots = (text) => parse(text).roots;
assert.deepEqual(
  roots(
    "(report: document (body: stack (sales: chart (title 'Presses') (series 1))))"
  ),
  roots(`report: document
  body: stack
    sales: chart
      title 'Presses'
      series 1`)
);
console.log('the example readers read both forms the same');
