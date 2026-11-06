import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { readSchema } from '@link-foundation/ui-settings';
import { readNumber } from '../../src/controls/index.js';
import { createSettingsPanel } from '../../src/settings/index.js';
import { mountDoc, typeInto, commit, microtasks } from '../support/controls.js';

const range = { min: 0, max: 1, step: 0.01, normalization: 'clamp' };

test('typed normalization clamps continuously independently of directional stepping', () => {
  assert.deepEqual(readNumber('0.075', range), {
    value: 0.075,
    invalid: false,
  });
  assert.deepEqual(readNumber('0,075', range), {
    value: 0.075,
    invalid: false,
  });
  assert.deepEqual(readNumber('2', range), { value: 1, invalid: false });
  assert.deepEqual(readNumber('-2', range), { value: 0, invalid: false });
  assert.deepEqual(readNumber('', range), { value: null, invalid: false });
  assert.deepEqual(readNumber('Infinity', range), { invalid: true });
  assert.deepEqual(readNumber('0.075', { ...range, normalization: 'snap' }), {
    value: 0.08,
    invalid: false,
  });
  assert.deepEqual(
    readNumber('0.075', { ...range, normalization: undefined }),
    { value: 0.08, invalid: false }
  );
});

test('continuous drafts and commits keep the live store exact; pointer stepping and clearing remain independent', async () => {
  const t = mountDoc(`n: number-field Opacity
  min 0
  max 1
  step 0.01
  fallback 0.075
  normalization clamp
  snapping directional`);
  const input = t.part('n', 'input');
  typeInto(input, '0.075');
  await microtasks();
  assert.deepEqual(t.prop('n', 'value'), ['0.075']);
  assert.equal(input.getAttribute('aria-valuenow'), '0.075');
  commit(input);
  await microtasks();
  assert.equal(input.value, '0.075');
  t.part('n', 'increment').click();
  assert.deepEqual(t.prop('n', 'value'), ['0.08']);
  typeInto(input, '');
  await microtasks();
  assert.equal(t.prop('n', 'value'), undefined);
  t.part('n', 'increment').click();
  assert.deepEqual(t.prop('n', 'value'), ['0.08']);
  t.mounted.destroy();
});

test('generated number editors inherit the settings engine continuous policy', async () => {
  const { schema } = readSchema(
    `s: schema
  version 1
opacity:
  type number
  default 0
  min 0
  max 1
  step 0.01`,
    { normalization: { numbers: 'clamp' } }
  );
  const dom = new JSDOM('<body></body>');
  const panel = createSettingsPanel(schema, { document: dom.window.document });
  dom.window.document.body.append(panel.element);
  const input = panel.element.querySelector('[role=spinbutton]');
  typeInto(input, '0.075');
  await microtasks();
  assert.equal(panel.values().opacity, 0.075);
  commit(input);
  assert.equal(panel.values().opacity, 0.075);
  panel.destroy();
  dom.window.close();
});
