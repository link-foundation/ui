import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  readFrames,
  resolveFrame,
  frameGeometry,
} from '../src/classic/frame-schema.js';

const text = `frames
  panel
    corner top-left cut
      size 100
      width 40
      stroke 3
    corner top-right round
      size 20
    edge top bracket
      stroke 4
      color '#abc'
    state hover
      edge bottom accent
        stroke 6
  button
    extends panel
    corner bottom-right scoop
      size 15
    state selected
      corner top-left notch
        size 8
`;
it('reads per-corner, edge, state and level inheritance without coupling surface materials', () => {
  const frames = readFrames(text);
  const panel = resolveFrame(frames, 'panel', ['hover']);
  const button = resolveFrame(frames, 'button', ['hover', 'selected']);
  assert.equal(panel.corners['top-left'].size, 100);
  assert.equal(button.corners['top-left'].shape, 'notch');
  assert.equal(button.edges.bottom.line, 'accent');
  assert.equal(button.edges.top.color, '#abc');
  assert.equal(button.corners['bottom-right'].shape, 'scoop');
  const normal = resolveFrame(frames, 'button');
  assert.equal(normal.corners['top-left'].shape, 'cut');
  assert.equal(normal.edges.bottom.line, 'line');
});
it('uses pixels above 48 and fits tiny frames without intersecting adjacent corners', () => {
  const frame = resolveFrame(readFrames(text), 'panel');
  const large = frameGeometry(frame, 400, 300);
  assert.equal(large.corners['top-left'].height, 100);
  assert.equal(large.corners['top-left'].width, 40);
  const small = frameGeometry(frame, 12, 8);
  assert.ok(small.corners['top-left'].height <= 8);
  assert.ok(
    small.corners['top-left'].width + small.corners['top-right'].width <= 12
  );
  assert.match(large.path, /^M/u);
  assert.match(large.borderSvg, /fill="none"/u);
  assert.doesNotMatch(large.borderSvg, /<rect|background/u);
});
it('rejects unknown names, negative dimensions, duplicate levels and inheritance cycles', () => {
  assert.throws(
    () => readFrames('frames\n  panel\n    corner top-left bogus'),
    /shape/u
  );
  assert.throws(
    () => readFrames('frames\n  panel\n    edge left line\n      stroke -1'),
    /nonnegative/u
  );
  assert.throws(() => readFrames('frames\n  panel\n  panel'), /Duplicate/u);
  const cyclic = readFrames(
    'frames\n  panel\n    extends button\n  button\n    extends panel'
  );
  assert.throws(() => resolveFrame(cyclic, 'panel'), /cycle/u);
});
