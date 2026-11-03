/**
 * Behaviour: `drawLinkCanvas` draws the same scene as the SVG renderer:
 * background, grid, line, markers from markers.js and dashed blueprint
 * circles, in token colours.
 */

import { describe, it, expect } from 'test-anywhere';
import { linkGeometry } from '../../src/links-view/geometry.js';
import { linkColors } from '../../src/links-view/tokens.js';
import { drawLinkCanvas } from '../../src/links-view/render-canvas.js';
import { FakePath2D, fakeContext } from './fake-canvas.js';

const colors = linkColors();
const geometry = linkGeometry({
  source: { x: -80, y: 0 },
  target: { x: 80, y: 0 },
});

/** Whether a call was made with exactly these arguments. */
const called = (ctx, ...call) =>
  ctx.calls.some((c) => JSON.stringify(c) === JSON.stringify(call));

const draw = (overrides = {}) => {
  const ctx = fakeContext();
  const result = drawLinkCanvas(ctx, geometry, {
    width: 320,
    height: 200,
    view: { x: 160, y: 100, k: 2 },
    colors,
    pixelRatio: 2,
    Path2D: FakePath2D,
    ...overrides,
  });
  return { ctx, result };
};

describe('drawLinkCanvas', () => {
  it('fills the background and applies the pixel ratio and view', () => {
    const { ctx } = draw();
    expect(called(ctx, 'setTransform', 2, 0, 0, 2, 0, 0)).toBe(true);
    expect(called(ctx, 'set:fillStyle', colors.background)).toBe(true);
    expect(called(ctx, 'fillRect', 0, 0, 320, 200)).toBe(true);
    expect(called(ctx, 'transform', 2, 0, 0, 2, 160, 100)).toBe(true);
  });

  it('draws the line as cubic curves in the line colour', () => {
    const { ctx } = draw();
    const curves = ctx.calls.filter((c) => c[0] === 'bezierCurveTo');
    expect(curves.length).toBe(geometry.path.length);
    expect(called(ctx, 'set:strokeStyle', colors.line)).toBe(true);
  });

  it('returns the markers it drew', () => {
    expect(draw().result.markers).toEqual(['bar', 'arrow']);
    expect(
      draw({ ends: { source: 'none', target: 'cross' } }).result.markers
    ).toEqual(['cross']);
  });

  it('draws dashed blueprint circles in their colours', () => {
    const { ctx } = draw({ blueprint: true });
    expect(called(ctx, 'setLineDash', [4, 2])).toBe(true);
    const arcs = ctx.calls.filter((c) => c[0] === 'arc');
    expect(arcs.length).toBe(geometry.points.length);
    for (const role of [
      'blueprintStart',
      'blueprintEnd',
      'blueprintCenter',
      'blueprintPoint',
    ]) {
      expect(called(ctx, 'set:strokeStyle', colors[role])).toBe(true);
    }
  });

  it('draws grid lines only when asked', () => {
    const lines = (ctx) => ctx.calls.filter((c) => c[0] === 'lineTo').length;
    expect(lines(draw().ctx)).toBe(0);
    expect(lines(draw({ grid: true }).ctx) > 0).toBe(true);
  });

  it('leaves the context state as it found it', () => {
    const { ctx } = draw({ blueprint: true, grid: true });
    const saves = ctx.calls.filter((c) => c[0] === 'save').length;
    const restores = ctx.calls.filter((c) => c[0] === 'restore').length;
    expect(saves).toBe(restores);
    expect(ctx.calls.at(-1)).toEqual(['restore']);
  });
});
