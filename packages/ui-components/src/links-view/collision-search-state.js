import { fittedCurve } from './doublet-geometry.js';
import { doubletCurves } from './doublet-curves.js';
import { paintDoublet, paintedPair, ownScore } from './painted-collisions.js';

const samePath = (a, b) =>
  a.path.every((part, i) =>
    ['p0', 'c1', 'c2', 'p3'].every(
      (key) =>
        part[key].x === b.path[i][key].x && part[key].y === b.path[i][key].y
    )
  );

function boundedGaps(preview, entry, baseline, scale, options, symmetric) {
  const gaps = [...entry.gaps];
  const original = baseline.gaps.map((gap, i) => gap ?? options.gaps[i]);
  const outer = preview.lengths.map(
    (length) => Math.min(30, length * 0.3) / scale
  );
  const clamp = (i, cap) => {
    if (gaps[i] !== null && gaps[i] > original[i]) {
      gaps[i] = cap <= original[i] ? baseline.gaps[i] : Math.min(cap, gaps[i]);
    }
  };
  if (
    symmetric &&
    gaps[0] !== null &&
    gaps[0] === gaps[1] &&
    gaps[0] > Math.min(original[0], original[1])
  ) {
    const cap = Math.min(...outer);
    if (cap < Math.max(original[0], original[1])) {
      [gaps[0], gaps[1]] = baseline.gaps;
    } else {
      clamp(0, cap);
      clamp(1, cap);
    }
  } else {
    clamp(0, outer[0]);
    clamp(1, outer[1]);
  }
  clamp(2, Math.min(30, preview.lengths[0] * 0.3, preview.cutLengths[0] * 0.3));
  clamp(3, Math.min(30, preview.lengths[1] * 0.3, preview.cutLengths[1] * 0.3));
  return gaps.every((gap, i) => gap === entry.gaps[i])
    ? entry
    : { ...entry, gaps };
}

export function symmetricReferences(pairs, i) {
  const [ref, target] = pairs[i];
  return (
    ref !== 0 &&
    ref !== i + 1 &&
    ref === target &&
    pairs[ref - 1].every((end) => end === ref)
  );
}

export function cutsWithinBounds(frame, entries, baseline) {
  const { curves, options, pairs, transform } = frame;
  return curves.every((curve, i) => {
    const entry = entries[i];
    return (
      entry ===
      boundedGaps(
        curve,
        entry,
        baseline[i],
        transform[0],
        options,
        symmetricReferences(pairs, i)
      )
    );
  });
}

export const linkedOptions = (options, entries) => ({
  ...options,
  links: Object.fromEntries(entries.map((entry, i) => [i + 1, entry])),
});

function nativeCandidate({ pairs, places, transform }, options, bound, dirty) {
  const layoutCurves = doubletCurves(pairs, places, options);
  const curves = layoutCurves.map((raw, i) => {
    if (!dirty(raw, i)) {
      return null;
    }
    let fitted = fittedCurve(raw, transform, options);
    for (let pass = 0; pass < 2 && bound(fitted, i); pass++) {
      fitted = fittedCurve(raw, transform, options);
    }
    return fitted;
  });
  return { layoutCurves, curves };
}

function adaptedCandidate(pairs, options, geometry, bound, baseline) {
  let candidate = geometry(pairs, options);
  for (let pass = 0; pass < 2; pass++) {
    if (!candidate.curves.map(bound).some(Boolean)) {
      return candidate;
    }
    candidate = geometry(pairs, options);
  }
  let measuredAgain = false;
  candidate.curves.forEach((curve, i) => {
    if (bound(curve, i)) {
      options.links[i + 1] = {
        ...options.links[i + 1],
        gaps: baseline[i].gaps,
      };
      measuredAgain = true;
    }
  });
  return measuredAgain ? geometry(pairs, options) : candidate;
}

export function searchState(frame, baseline, geometry) {
  const { options, pairs, transform } = frame;
  const symmetric = pairs.map((_, i) => symmetricReferences(pairs, i));
  const { strokeWidth, clearance } = options;
  const rawPair = (a, b) => paintedPair(a, b, clearance, strokeWidth);
  const diagonal = (curves, i, j) =>
    i === j ? ownScore(curves[i]) : rawPair(curves[i], curves[j]);
  let current = {
    raw: frame.layoutCurves,
    entries: baseline,
    painted: frame.curves.map((curve) =>
      paintDoublet(curve, options, clearance)
    ),
    count: 0,
    cost: 0,
  };
  const scores = pairs.map((_, i) =>
    Array.from({ length: i + 1 }, (_, j) => {
      const score = diagonal(current.painted, i, j);
      current.count += score.count;
      current.cost += score.cost;
      return score;
    })
  );

  function evaluate(entries, changed) {
    const optionsForCandidate = linkedOptions(
      { ...options, frame: transform },
      entries
    );
    // Neutral collinear overlaps can bend an otherwise untouched half when an
    // adjacent reference turns. Compare the raw curves before reusing paint.
    const dirtyCurve = (curve, i) =>
      optionsForCandidate.links[i + 1] !== current.entries[i] ||
      changed.includes(i) ||
      !samePath(curve, current.raw[i]);
    const bound = (curve, i) => {
      const entry = optionsForCandidate.links[i + 1];
      const next = boundedGaps(
        curve,
        entry,
        baseline[i],
        transform[0],
        options,
        symmetric[i]
      );
      optionsForCandidate.links[i + 1] = next;
      return entry !== next;
    };
    const { layoutCurves: raw, curves } = geometry
      ? adaptedCandidate(pairs, optionsForCandidate, geometry, bound, baseline)
      : nativeCandidate(frame, optionsForCandidate, bound, dirtyCurve);
    const dirty = raw.map(dirtyCurve);
    const painted = current.painted.slice();
    dirty.forEach((updated, i) => {
      if (updated) {
        painted[i] = paintDoublet(curves[i], options, clearance);
      }
    });
    const updates = [];
    let { count, cost } = current;
    dirty.forEach((updated, i) => {
      if (!updated) {
        return;
      }
      for (let j = 0; j < pairs.length; j++) {
        if (j < i && dirty[j]) {
          continue;
        }
        const row = Math.max(i, j),
          col = Math.min(i, j);
        const score = diagonal(painted, row, col);
        count += score.count - scores[row][col].count;
        cost += score.cost - scores[row][col].cost;
        updates.push([row, col, score]);
      }
    });
    return {
      raw,
      painted,
      count,
      cost: count ? cost : 0,
      updates,
      entries: entries.map((_, i) => optionsForCandidate.links[i + 1]),
    };
  }

  return {
    get current() {
      return current;
    },
    evaluate,
    commit(next) {
      for (const [i, j, score] of next.updates) {
        scores[i][j] = score;
      }
      current = next;
    },
  };
}
