// Bounded reproduction of the consumer's continuous-value stepping boundary.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { nextValue } from '../packages/ui-components/src/controls/numeric-keys.js';
const source = execFileSync(
  'git',
  [
    'show',
    'f72e97fe2db100d88ea460ee8451bbf63a1b01b6:packages/ui-components/src/controls/numeric-keys.js',
  ],
  { encoding: 'utf8', maxBuffer: 65536 }
);
const before = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const state = {
  value: 0.075,
  min: 0,
  max: 1,
  step: 0.01,
  snapping: 'directional',
};
assert.equal(before.nextValue('ArrowUp', state), 0.09);
assert.equal(nextValue('ArrowUp', state), 0.08);
console.log(
  'Continuous import: original 0.075 → 0.09; directional policy 0.075 → 0.08'
);
