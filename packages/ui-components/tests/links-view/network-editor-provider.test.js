import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createNetworkPresentation } from '../../src/links-view/presentation.js';
import {
  createNetworkEditorProvider,
  rendererOptions,
} from '../../src/links-view/network-editor/provider.js';
import {
  normalize,
  toOptions,
} from '../../src/links-view/network-editor/options.js';
import { readDoubletOptions } from '../../src/links-view/doublet.js';

it('adapts renderer options and all per-link overrides without marking default markers explicit', async () => {
  assert.equal(rendererOptions({}, 2), '');
  assert.deepEqual(
    readDoubletOptions(rendererOptions({}, 2), 2).end.explicit,
    []
  );
  const options = normalize({
    'start.shape': 'diamond',
    'background.type': 'linear',
    'caption.text': 'Quoted "text"',
    tension: 0.8,
    startGap: 0.2,
    frame: [2, 10, -5],
    turns: [[30, -30]],
    linkGaps: [[0.1, null, 5, null]],
    linkColors: ['#abcdef'],
    order: [2, 1],
    passes: 5,
  });
  const parsed = readDoubletOptions(rendererOptions(options, 2), 2);
  assert.deepEqual(parsed.links[1].turns, [30, -30]);
  assert.deepEqual(parsed.links[1].gaps, [0.1, null, 5, null]);
  assert.equal(parsed.start.shape, 'diamond');
  assert.equal(parsed.background.type, 'linear');
  assert.equal(parsed.caption.text, 'Quoted "text"');
  assert.deepEqual(parsed.frame, [2, 10, -5]);
  assert.deepEqual(parsed.order, [2, 1]);
  assert.deepEqual(parsed.gaps, [0.2, 0.08, 0, 0]);
  const presentation = createNetworkPresentation(createNetworkEditorProvider());
  try {
    await presentation.update({
      items: [
        [2, 2],
        [1, 1],
      ],
      options: toOptions(options),
    });
    assert.match(presentation.toSvg(), /data-doublet="1" color="#abcdef"/u);
    assert.equal(presentation.snapshot().frame.options.tension, 0.8);
    assert.deepEqual(presentation.snapshot().frame.transform, [2, 10, -5]);
  } finally {
    presentation.dispose();
  }
});
