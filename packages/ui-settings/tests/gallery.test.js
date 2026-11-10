import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readSchema,
  applyPreset,
  activePreset,
  randomize,
} from '../src/index.js';

const { schema } = readSchema(`s: schema
  version 1
weight:
  type number
  default 4
  min 0
  max 10
  random not-heavier-than-default
size:
  type range
  default 5
  min 0
  max 20
  step 2
  random
    min 3
    max 9
preset material
  partial
  description 'Just material'
  set weight 2`);

test('partial presets preserve unrelated fields and match only owned fields', () => {
  const values = applyPreset(schema, { size: 12 }, 'material');
  assert.equal(values.size, 12);
  assert.equal(values.weight, 2);
  assert.equal(activePreset(schema, values), 'material');
});

test('random constraints survive coercion on the original step grid in 1000 seeded draws', () => {
  let seed = 23;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 1000; i++) {
    const values = randomize(schema, undefined, { random });
    assert.ok(values.weight >= 0 && values.weight <= 4);
    assert.ok(values.size >= 3 && values.size <= 9);
    assert.equal(values.size % 2, 0);
  }
});
