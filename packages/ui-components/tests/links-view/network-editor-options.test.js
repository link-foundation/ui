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
  const reset = editOptions(options, { palette: 'default' });
  assert.equal(reset.palette, 'default');
  assert.equal(reset.color, normalize({}).color);
  assert.equal(toParams(reset).has('color'), false);
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

it('reads flat bookmarks with marker options, sparse turns and inherited gaps', () => {
  const options = fromParams(
    new globalThis.URLSearchParams({
      placement: 'square',
      linejoin: 'bevel',
      end: 'dot',
      endSize: '4',
      colors: '#123456,#fedcba',
      turns: ',30 -25',
      gaps: '0.2 ~ 5,',
      background: 'linear',
      bgAngle: '270',
      card: '1',
      border: '2',
      caption: 'custom',
      captionText: 'Hello',
      width: '1200',
      height: '630',
      quality: '0.7',
      'end.size': '6',
    })
  );
  assert.equal(options.layout, 'grid');
  assert.equal(options.linejoin, 'bevel');
  assert.equal(options['end.shape'], 'dot');
  assert.equal(options['end.size'], 6);
  assert.deepEqual(options.linkColors, ['#123456', '#fedcba']);
  assert.deepEqual(options.turns, [
    [0, 0],
    [30, -25],
  ]);
  assert.deepEqual(options.linkGaps[0], [0.2, null, 5, null]);
  assert.equal(options['background.angle'], -90);
  assert.equal(options['card.width'], 2);
  assert.equal(options['caption.text'], 'Hello');
  assert.equal(options.quality, 0.7);
  assert.deepEqual(fromParams(toParams(options)), options);
});

it('lets hosts select legacy defaults for bookmarks with only shared keys', () => {
  const params = 'width=1200';
  const legacy = fromParams(params, { legacy: true });
  assert.equal(legacy.width, 1200);
  assert.equal(legacy.height, 2048);
  assert.equal(legacy['background.color'], '#000000');
  assert.equal(fromParams(params).height, normalize({}).height);
  assert.equal(fromParams('rotation=270').rotation, -90);
  const turns = fromParams('turns=,30+-25');
  assert.equal(turns.height, 2048);
  assert.deepEqual(turns.turns, [
    [0, 0],
    [30, -25],
  ]);
});
