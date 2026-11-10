import { URL } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { doubletGeometry } from '../../src/links-view/doublet.js';
import { readDoubletOptions } from '../../src/links-view/doublet-options.js';
import { paintedReport } from './doublet-painted.js';

// Issue 249: the complete LiNo input that issue 228 calls clean for `22 11`.
const fixture = readFileSync(
  new URL('./fixtures/doublet-22-11-clean.lino', import.meta.url),
  'utf8'
);
const links = [
  [2, 2],
  [1, 1],
];
const clean = (report) =>
  report.crossings.length === 0 &&
  report.ownCrossings.length === 0 &&
  report.gap >= 1;

describe('clean 22 11 input shared with the collision solver', () => {
  it('is turns -90 90 on link 1 only with the default fixed 30 degree ends', () => {
    const o = readDoubletOptions(fixture, 2);
    assert.deepEqual(
      doubletGeometry(links, fixture).curves,
      doubletGeometry(links, 'link 1\n  turns -90 90\n').curves
    );
    assert.equal(o.angles, 'fixed');
    assert.equal(o.sourceAngle, 30);
    assert.equal(o.targetAngle, 30);
    assert.deepEqual(o.links[1].turns, [-90, 90]);
    assert.deepEqual(o.links[2]?.turns ?? [0, 0], [0, 0]);
    assert.deepEqual(o.gaps, [0.08, 0.08, 0, 0]);
  });

  it('paints no crossing and keeps the default clearance everywhere', () => {
    const frame = doubletGeometry(links, fixture);
    assert.deepEqual(frame.transform, [60, 50, 44]);
    const report = paintedReport(frame);
    assert.deepEqual(report.crossings, []);
    assert.deepEqual(report.ownCrossings, []);
    assert.ok(report.gap >= 1, `painted gap ${report.gap} is below 1`);
  });

  it('still reports the real collisions of other inputs', () => {
    const defaults = paintedReport(doubletGeometry(links, ''));
    assert.equal(defaults.crossings.length, 2);
    assert.ok(defaults.gap < 0);
    for (const options of [
      'link 1\n  turns -90 90\nlink 2\n  turns -90 90\n',
      'link 1\n  turns 90 -90\n',
      'link 2\n  turns -90 90\n',
    ]) {
      assert.equal(
        clean(paintedReport(doubletGeometry(links, options))),
        false
      );
    }
  });

  it('gives links whose two references cancel one shared middle direction', () => {
    const [first, second] = doubletGeometry(links, '').layoutCurves;
    assert.ok(Math.abs(first.direction.x - second.direction.x) < 1e-12);
    assert.ok(Math.abs(first.direction.y - second.direction.y) < 1e-12);
  });

  it('turns fixed angles to the mirror side, so 45 degrees is the lens', () => {
    const fixed = doubletGeometry(
      links,
      'angles fixed\nsourceAngle 45\ntargetAngle 45\n'
    );
    const mirror = doubletGeometry(links, 'angles mirror\n');
    assert.deepEqual(fixed.layoutCurves, mirror.layoutCurves);
  });

  it('backs a gapped reference end off along its end tangent', () => {
    const frame = doubletGeometry(links, fixture);
    for (const curve of frame.curves) {
      const [k] = frame.transform;
      const start = curve.path[0],
        end = curve.path[1];
      const along = (from, to, point) => {
        const d = { x: to.x - from.x, y: to.y - from.y };
        const p = { x: point.x - from.x, y: point.y - from.y };
        return {
          distance: Math.hypot(p.x, p.y),
          across: (d.x * p.y - d.y * p.x) / Math.hypot(d.x, d.y),
        };
      };
      const a = along(start.p0, start.c1, curve.visible[0].p0);
      const b = along(end.p3, end.c2, curve.visible[1].p3);
      // The start bar is not compensated, so the visible start is exactly the
      // gap away on the start tangent; the end arrow trims a little more.
      assert.ok(Math.abs(a.across) < 1e-9);
      assert.ok(Math.abs(a.distance - 0.08 * k) < 1e-9);
      assert.ok(b.distance > 0.08 * k);
    }
  });
});
