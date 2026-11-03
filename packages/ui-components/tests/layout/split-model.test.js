/**
 * split-model: resizeSplit keeps every size within min and max and the
 * total constant; collapsePane and restorePane.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  collapsePane,
  normalizeSizes,
  resizeSplit,
  restorePane,
} from '@link-foundation/ui-components';

const total = (sizes) => sizes.reduce((a, b) => a + b, 0);
const close = (a, b) => Math.abs(a - b) < 1e-6;

/** A deterministic pseudo-random generator (mulberry32, fixed seed). */
function random(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('resizeSplit', () => {
  it('moves a divider: the first pane grows and the second shrinks', () => {
    expect(resizeSplit([30, 70], 0, 10)).toEqual([40, 60]);
    expect(resizeSplit([20, 30, 50], 1, -5)).toEqual([20, 25, 55]);
  });

  it('stops at min and max', () => {
    const limits = { min: 20, max: 70 };
    expect(resizeSplit([30, 70], 0, -50, limits)).toEqual([30, 70]);
    expect(resizeSplit([40, 60], 0, -50, limits)).toEqual([30, 70]);
    expect(resizeSplit([40, 60], 0, 50, limits)).toEqual([70, 30]);
    expect(resizeSplit([25, 50, 25], 0, 100, { min: [10, 20, 10] })).toEqual([
      55, 20, 25,
    ]);
  });

  it('never leaves min and max, and keeps the total (1000 random moves)', () => {
    const next = random(36);
    const min = [10, 15, 5, 20];
    const max = [60, 50, 40, 70];
    const limits = { min, max };
    let sizes = [25, 25, 20, 30];
    for (let step = 0; step < 1000; step += 1) {
      const index = Math.floor(next() * 3);
      const delta = (next() - 0.5) * 80;
      sizes = resizeSplit(sizes, index, delta, limits);
      expect(close(total(sizes), 100)).toBe(true);
      sizes.forEach((size, i) => {
        expect(size).toBeGreaterThanOrEqual(min[i] - 1e-6);
        expect(size).toBeLessThanOrEqual(max[i] + 1e-6);
      });
    }
  });

  it('collapses a collapsible pane dragged below half its min, and opens it at min', () => {
    const limits = { min: 20, collapsible: [true, false] };
    expect(resizeSplit([25, 75], 0, -16, limits)).toEqual([0, 100]);
    expect(resizeSplit([25, 75], 0, -10, limits)).toEqual([20, 80]);
    expect(resizeSplit([0, 100], 0, 1, limits)).toEqual([20, 80]);
    // The second pane is not collapsible.
    expect(resizeSplit([75, 25], 0, 16, limits)).toEqual([80, 20]);
  });

  it('rejects bad input', () => {
    expect(() => resizeSplit([100], 0, 1)).toThrow();
    expect(() => resizeSplit([50, 50], 1, 1)).toThrow();
    expect(() => resizeSplit([50, 50], 0, Number.NaN)).toThrow();
    expect(() => resizeSplit([50, -1], 0, 1)).toThrow();
  });
});

describe('collapsePane and restorePane', () => {
  it('gives the size of a collapsed pane to the next pane', () => {
    expect(collapsePane([30, 70], 0)).toEqual([0, 100]);
    expect(collapsePane([20, 30, 50], 1)).toEqual([20, 0, 80]);
    // The last pane gives its size to the previous one.
    expect(collapsePane([20, 30, 50], 2)).toEqual([20, 80, 0]);
  });

  it('spreads the size when the next pane reaches its max', () => {
    expect(collapsePane([20, 30, 50], 1, { max: 60 })).toEqual([40, 0, 60]);
    expect(collapsePane([50, 50], 0, { max: 60 })).toEqual([50, 50]);
  });

  it('restores a pane, taking space from the nearest open panes', () => {
    const collapsed = collapsePane([30, 70], 0);
    expect(restorePane(collapsed, 0, 30)).toEqual([30, 70]);
    expect(restorePane([20, 0, 80], 1, 30, { min: 10 })).toEqual([20, 30, 50]);
    expect(restorePane([10, 0, 90], 1, 95, { min: 10 })).toEqual([10, 80, 10]);
    // Shrinking a pane gives its space to the neighbours.
    expect(restorePane([50, 50], 0, 30)).toEqual([30, 70]);
    // No room even for the pane's min: unchanged.
    expect(restorePane([50, 0, 50], 1, 30, { min: [50, 20, 50] })).toEqual([
      50, 0, 50,
    ]);
  });

  it('normalises remembered sizes', () => {
    expect(normalizeSizes([1, 3], 2)).toEqual([25, 75]);
    expect(normalizeSizes([30, 70, 0], 2)).toEqual([50, 50]);
    expect(normalizeSizes('bad', 3, 90)).toEqual([30, 30, 30]);
  });
});
