import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  networkOptionSchema,
  normalize,
  toParams,
  fromParams,
  toOptions,
  fromOptions,
  editOptions,
} from '../../src/links-view/network-editor/options.js';

it('omits defaults and round trips every scalar option at its bounds', () => {
  assert.equal(toParams(normalize({})).toString(), '');
  for (const field of networkOptionSchema) {
    for (const value of field.choices ??
      (field.type === 'number' ? [field.min, field.max] : [field.default])) {
      const options = normalize({ [field.key]: value });
      assert.deepEqual(fromParams(toParams(options)), options, field.key);
      assert.deepEqual(fromOptions(toOptions(options)), options, field.key);
    }
  }
});
it('clamps, ignores unknown URL fields, migrates gap and custom colours', () => {
  assert.equal(normalize({ tension: 9 }).tension, 2);
  assert.equal(normalize({ tension: Infinity }).tension, 0.4);
  const options = fromParams('gap=0.3&color=%23ff0000&unknown=42');
  assert.equal(options.startGap, 0.3);
  assert.equal(options.endGap, 0.3);
  assert.equal(options.palette, 'custom');
  assert.equal(Object.hasOwn(options, 'unknown'), false);
});
it('round trips per-link overrides and pinned frame without precision loss', () => {
  const options = normalize({
    frame: [2, 10, -5],
    order: [2, 1],
    turns: [
      [30, -30],
      [0, 0],
    ],
    linkGaps: [[null, 0.2, 5, null]],
    linkColors: ['#abcdef'],
  });
  assert.deepEqual(fromParams(toParams(options)), options);
  assert.deepEqual(fromOptions(toOptions(options)), options);
});

it('all colour fields retain a pinned frame while geometric caption changes clear it', () => {
  const frame = [2, 10, -5];
  const options = normalize({ frame });
  for (const field of networkOptionSchema.filter(
    (field) => field.type === 'color'
  )) {
    assert.deepEqual(
      editOptions(options, { [field.key]: '#abcdef' }).frame,
      frame
    );
  }
  assert.equal(editOptions(options, { 'caption.size': 8 }).frame, null);
});
