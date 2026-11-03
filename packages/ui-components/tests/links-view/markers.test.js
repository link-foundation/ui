/**
 * Behaviour: marker shapes are data in one module, used by both renderers.
 * The SVG output and the canvas drawing of a link name the same markers.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  DEFAULT_ENDS,
  MARKERS,
  MARKER_IDS,
  drawMarker,
  getMarker,
  markerElementId,
  svgMarkerDefs,
} from '../../src/links-view/markers.js';
import { linkGeometry } from '../../src/links-view/geometry.js';
import { linkColors } from '../../src/links-view/tokens.js';
import { buildScene } from '../../src/links-view/scene.js';
import {
  drawnMarkers,
  renderLinkSvg,
} from '../../src/links-view/render-svg.js';
import { drawLinkCanvas } from '../../src/links-view/render-canvas.js';
import { FakePath2D, fakeContext } from './fake-canvas.js';

const colors = linkColors();
const geometry = linkGeometry({
  source: { x: 0, y: 0 },
  target: { x: 100, y: 0 },
});

describe('MARKERS', () => {
  it('has the five shapes, as frozen data in a 100 × 100 box', () => {
    expect([...MARKER_IDS]).toEqual(['bar', 'arrow', 'cross', 'dot', 'none']);
    for (const id of MARKER_IDS) {
      const m = MARKERS[id];
      expect(m.id).toBe(id);
      expect(m.viewBox).toBe('0 0 100 100');
      expect(typeof m.path).toBe('string');
      expect(typeof m.refX).toBe('number');
      expect(typeof m.refY).toBe('number');
      expect(Object.isFrozen(m)).toBe(true);
    }
    expect(Object.isFrozen(MARKERS)).toBe(true);
    expect(MARKERS.none.path).toBe('');
    expect(DEFAULT_ENDS).toEqual({ source: 'bar', target: 'arrow' });
  });

  it('looks up shapes by name only', () => {
    expect(getMarker('arrow')).toBe(MARKERS.arrow);
    expect(getMarker('toString')).toBe(undefined);
    expect(getMarker('nope')).toBe(undefined);
  });
});

describe('svgMarkerDefs', () => {
  it('writes one marker element per end, coloured from the tokens', () => {
    const defs = svgMarkerDefs({ source: 'bar', target: 'arrow' }, colors, {
      idPrefix: 'v1',
    });
    expect(defs).toContain(`id="${markerElementId('v1', 'source', 'bar')}"`);
    expect(defs).toContain('id="v1-target-arrow"');
    expect(defs).toContain(`d="${MARKERS.arrow.path}"`);
    expect(defs).toContain(`stroke="${colors.source}"`);
    expect(defs).toContain('viewBox="0 0 100 100"');
    expect(defs).toContain('orient="auto"');
  });

  it('writes nothing for none and unknown shapes', () => {
    expect(svgMarkerDefs({ source: 'none', target: 'zzz' }, colors)).toBe('');
  });

  it('fills a dot', () => {
    const defs = svgMarkerDefs({ target: 'dot' }, colors);
    expect(defs).toContain(`fill="${colors.target}" stroke="none"`);
  });
});

describe('drawMarker', () => {
  it('draws the marker path through Path2D at the point and angle', () => {
    const ctx = fakeContext();
    const drawn = drawMarker(ctx, MARKERS.arrow, { x: 5, y: 6 }, Math.PI, 2, {
      color: '#123456',
      Path2D: FakePath2D,
    });
    expect(drawn).toBe(true);
    const calls = ctx.calls.filter((c) => !c[0].startsWith('set:'));
    const names = calls.map((c) => c[0]);
    expect(names).toEqual([
      'save',
      'translate',
      'rotate',
      'scale',
      'translate',
      'setLineDash',
      'stroke',
      'restore',
    ]);
    expect(calls[1]).toEqual(['translate', 5, 6]);
    expect(calls[4]).toEqual(['translate', -10, -50]);
    expect(calls[6][1].d).toBe(MARKERS.arrow.path);
    expect(ctx.state.strokeStyle).toBe('#123456');
  });

  it('fills a dot and skips none', () => {
    const ctx = fakeContext();
    const options = { color: '#ABCDEF', Path2D: FakePath2D };
    expect(drawMarker(ctx, MARKERS.dot, { x: 0, y: 0 }, 0, 1, options)).toBe(
      true
    );
    expect(ctx.calls.some((c) => c[0] === 'fill')).toBe(true);
    expect(drawMarker(ctx, MARKERS.none, { x: 0, y: 0 }, 0, 1, options)).toBe(
      false
    );
  });
});

describe('SVG and Canvas use the same markers', () => {
  for (const ends of [
    { source: 'bar', target: 'arrow' },
    { source: 'cross', target: 'dot' },
    { source: 'none', target: 'arrow' },
    { source: 'dot', target: 'none' },
  ]) {
    it(`${ends.source} → ${ends.target}`, () => {
      const style = { width: 200, height: 100, colors, ends };
      const svg = renderLinkSvg(geometry, style);
      const ids = [...svg.matchAll(/data-marker="([a-z]+)"/gu)].map(
        (m) => m[1]
      );
      const ctx = fakeContext();
      const canvas = drawLinkCanvas(ctx, geometry, {
        ...style,
        Path2D: FakePath2D,
      });
      expect(canvas.markers).toEqual(ids);
      expect(drawnMarkers(buildScene(geometry, style))).toEqual(ids);
      // The canvas drew exactly the path data of those markers.
      const drawnPaths = ctx.calls
        .filter((c) => (c[0] === 'stroke' || c[0] === 'fill') && c[1])
        .map((c) => c[1].d);
      expect(drawnPaths).toEqual(ids.map((id) => MARKERS[id].path));
    });
  }
});
