import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  readFrames,
  resolveFrame,
  frameGeometry,
} from '../src/classic/frame-schema.js';

it('keeps explicit dimensions independent of tall and wide default proportions', () => {
  const frames = readFrames(`frames
  panel
    corner top-left tall
      size 80
      width 30
    corner top-right wide
      size 80
      height 25
`);
  const geometry = frameGeometry(resolveFrame(frames, 'panel'), 320, 200);
  assert.equal(geometry.corners['top-left'].width, 30);
  assert.equal(geometry.corners['top-right'].height, 25);
});

const source = `frames
  panel
    style dotted
    opacity 0.4
    corner top-left cut
      size 200
      line bracket
      arm 30
      stroke auto
      color 'primary at 30%'
    edge top accent
      style double
      stroke 2.5
  block
    extends panel
      scale 0.6
    mode frame
    layer below
    min-width 40
    fitScale 0
    corner top-left cut
      size auto
  control
    extends block
      scale 0.35
`;
it('reads scaled block inheritance, automatic strokes and sizes, styles and fit options', () => {
  const frames = readFrames(source);
  const block = resolveFrame(frames, 'block');
  const control = resolveFrame(frames, 'control');
  assert.equal(block.corners['top-left'].size, 120);
  assert.equal(block.corners['top-left'].arm, 18);
  assert.equal(control.corners['top-left'].size, 42);
  assert.equal(control.edges.top.stroke, 2.5);
  assert.equal(block.edges.top.style, 'double');
  assert.equal(block.edges.left.style, 'dotted');
  assert.equal(block.corners['top-left'].stroke, 2.5);
  assert.equal(block.opacity, 0.4);
  assert.equal(block.layer, 'below');
  assert.equal(block.mode, 'frame');
  assert.equal(block.fitScale, 0);
  assert.equal(block.corners['top-left'].color, 'primary at 30%');
});
it('rejects invalid enumerations, stroke steps, fit limits and scales', () => {
  for (const declaration of [
    'style groove',
    'opacity 2',
    'mode fake',
    'layer middle',
    'min-width 1601',
    'fitScale -0.1',
    'extends panel\n      scale 0.09',
    'corner top-left cut\n      stroke 1.1',
    'edge top line\n      stroke 13',
    'corner top-left cut\n      line unknown',
  ]) {
    assert.throws(() => readFrames(`frames\n  button\n    ${declaration}`));
  }
});

it('accepts fractional edge widths independently of half-pixel corner controls', () => {
  const frame = resolveFrame(
    readFrames('frames\n  panel\n    edge top line\n      stroke 1.2'),
    'panel'
  );
  assert.equal(frame.edges.top.stroke, 1.2);
  assert.equal(frame.corners['top-left'].stroke, 1.2);
});

it('uses nested-block and control defaults while keeping stroke widths and explicit dimensions independent', () => {
  const frames = readFrames(`frames
  panel
    corner top-left cut
      size 100
      arm 20
      stroke auto
    edge top line
      stroke 3
    state selected
      corner top-left round
        size 80
      edge top line
        stroke 4
  block
    extends panel
  control
    extends panel
`);
  assert.equal(resolveFrame(frames, 'block').corners['top-left'].size, 60);
  const control = resolveFrame(frames, 'control', ['selected']);
  assert.equal(control.corners['top-left'].size, 28);
  assert.equal(control.corners['top-left'].arm, 7);
  assert.equal(control.corners['top-left'].stroke, 4);
});
