import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSchema, defaults, randomize } from '@link-foundation/ui-settings';
import { controlFor, buildPanelModel } from '../../src/settings/index.js';

for (const [type, element] of Object.entries({
  toggle: 'switch',
  choice: 'select',
  range: 'slider',
  number: 'number-field',
  color: 'color-field',
  text: 'text-field',
  vector: 'vector',
  vector3: 'vector',
  list: 'chips',
})) {
  test(`controlFor maps ${type}`, () => {
    const field = {
      type,
      key: 'a',
      label: 'A',
      min: 0,
      max: 10,
      step: 1,
      options: ['a', 'b'],
    };
    assert.equal(controlFor(field).element, element);
    assert.equal(controlFor(field).props.label, 'A');
    assert.equal(controlFor(field).props.min, 0);
  });
}

test('unsupported controls report their type', () => {
  assert.throws(() => controlFor({ type: 'unknown' }), /unknown/);
});

const { schema } = readSchema(`appearance: section
  label Appearance
blur:
  type range
  default 18
  min 0
  max 40
  section appearance
  label Blur
mode:
  type choice
  default auto
  options auto light dark
preset calm
  set blur 24
  set mode dark
`);

test('active preset ignores key order, search preserves total changed count', () => {
  const model = buildPanelModel(
    schema,
    { mode: 'dark', blur: 24 },
    { query: 'BLUR' }
  );
  assert.equal(model.activePreset, 'calm');
  assert.equal(model.changedCount, 2);
  assert.deepEqual(
    model.sections.flatMap((s) => s.fields.map((f) => f.key)),
    ['blur']
  );
  assert.equal(buildPanelModel(schema, defaults(schema)).changedCount, 0);
  assert.equal(
    buildPanelModel(schema, {}, { query: 'absent' }).sections.length,
    0
  );
});

test('seeded randomization produces identical values', () => {
  const seed = () => {
    let state = 42;
    return () => (state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  };
  assert.deepEqual(
    randomize(schema, {}, { random: seed() }),
    randomize(schema, {}, { random: seed() })
  );
});
