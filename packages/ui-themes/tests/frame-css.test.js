import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  readFrames,
  framesCss,
  frameLayers,
  FRAME_LEVELS,
} from '../src/classic/frames.js';
import { validClipPath } from '../../ui-style/src/clip-path.js';

const source = `frames
  panel
    corner top-left round
      size 60
      color 'primary at 30%'
    edge top line
      style dotted
    state hover
      opacity 0.8
    state active
      opacity 0.6
    state selected
      opacity 0.4
    state focus
      opacity 0.2
  block
    extends panel
      scale 0.6
`;
it('emits deterministic independent chunks, typed registrations and a discoverable live API', () => {
  const frames = readFrames(source);
  const options = {
    scope: '.preview',
    prefix: 'test',
    levels: { panel: ['article', '.card'], block: ['section'] },
    selected: ['.chosen', '[data-chosen]'],
  };
  const css = framesCss(frames, options);
  assert.deepEqual(css, framesCss(frames, options));
  assert.match(css.levels.panel, /:where\(article\), :where\(\.card\)/u);
  assert.match(css.levels.panel, /:is\(\.chosen, \[data-chosen\]\)/u);
  assert.match(css.properties, /syntax: "<length>"/u);
  assert.match(css.properties, /syntax: "<color>"/u);
  assert.match(css.properties, /syntax: "<image> \| none"/u);
  assert.match(
    css.properties,
    /@property --test-panel-min-width \{[^}]*inherits: false/su
  );
  assert.match(
    css.levels.block,
    /calc\(var\(--test-panel-tl-size\) \* var\(--test-block-scale\)\)/u
  );
  assert.doesNotMatch(
    css.levels.block,
    /clip-path:|polygon\(|container-type:/u
  );
  assert.ok(css.controls.some((c) => c.property === '--test-panel-tl-size'));
  assert.ok(
    css.controls.some((c) => c.attribute === 'data-test-panel-top-left-shape')
  );
  assert.match(
    css.levels.panel,
    /color-mix\(in srgb, var\(--color-primary, currentColor\) 30%, transparent\)/u
  );
  const hover = css.levels.panel.indexOf(':hover:not(');
  assert.ok(hover < css.levels.panel.indexOf(':active'));
  assert.ok(
    css.levels.panel.indexOf(':active') <
      css.levels.panel.indexOf(':is(.chosen')
  );
  assert.ok(
    css.levels.panel.indexOf(':is(.chosen') <
      css.levels.panel.indexOf(':focus-visible')
  );
  assert.match(frameLayers(), /aria-hidden="true"/u);
});
it('ui-style accepts every generated clip, for all eleven levels', () => {
  const frames = readFrames(
    `frames\n${FRAME_LEVELS.map((id) => `  ${id}\n    corner top-left cut\n      size 128`).join('\n')}`
  );
  const css = framesCss(frames);
  const clips = [...css.base.matchAll(/clip-path: ([^;]+);/gu)].map(
    (m) => m[1]
  );
  assert.equal(clips.length, 9);
  for (const clip of clips) {
    assert.ok(validClipPath(clip), clip.slice(0, 200));
  }
  assert.equal(Object.keys(css.levels).length, 11);
});
it('rejects unsafe colors and invalid selector/configuration inputs', () => {
  const frames = readFrames(source);
  for (const options of [
    { prefix: 'bad;' },
    { scope: ':root{}' },
    { levels: { fake: ['div'] } },
    { selected: [] },
  ]) {
    assert.throws(() => framesCss(frames, options));
  }
  assert.throws(
    () =>
      framesCss(
        readFrames(
          "frames\n  panel\n    edge top line\n      color 'red; display:none'"
        )
      ),
    /color/u
  );
});
