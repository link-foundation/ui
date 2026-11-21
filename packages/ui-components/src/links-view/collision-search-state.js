import { fittedCurve } from './doublet-geometry.js';
import { doubletCurves } from './doublet-curves.js';
import { paintDoublet, paintedPair, ownScore } from './painted-collisions.js';

const samePath = (a, b) =>
  a.path.every((part, i) =>
    ['c1', 'c2'].every(
      (key) =>
        part[key].x === b.path[i][key].x && part[key].y === b.path[i][key].y
    )
  );

function boundedCurve(raw, entry, baseline, transform, options, symmetric) {
  const preview = fittedCurve(raw, transform, options);
  const gaps = [...entry.gaps];
  const original = baseline.gaps.map((gap, i) => gap ?? options.gaps[i]);
  const outer = preview.lengths.map(
    (length) => Math.min(30, length * 0.3) / transform[0]
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
  let fitted = preview;
  if (gaps[0] !== entry.gaps[0] || gaps[1] !== entry.gaps[1]) {
    options.links[raw.id] = { turns: entry.turns, gaps };
    fitted = fittedCurve(raw, transform, options);
  }
  clamp(2, Math.min(30, fitted.lengths[0] * 0.3, fitted.cutLengths[0] * 0.3));
  clamp(3, Math.min(30, fitted.lengths[1] * 0.3, fitted.cutLengths[1] * 0.3));
  if (gaps[2] === entry.gaps[2] && gaps[3] === entry.gaps[3]) {
    return fitted;
  }
  options.links[raw.id] = { turns: entry.turns, gaps };
  return fittedCurve(raw, transform, options);
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

const linkedOptions = (options, entries) => ({
  ...options,
  links: Object.fromEntries(entries.map((entry, i) => [i + 1, entry])),
});

export function searchState(frame, baseline) {
  const { options, pairs, places, transform } = frame;
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
    const candidate = linkedOptions(options, entries);
    // Neutral collinear overlaps can bend an otherwise untouched half when an
    // adjacent reference turns. Compare the raw curves before reusing paint.
    const raw = doubletCurves(pairs, places, candidate);
    const dirty = raw.map(
      (curve, i) =>
        entries[i] !== current.entries[i] ||
        changed.includes(i) ||
        !samePath(curve, current.raw[i])
    );
    const painted = current.painted.slice();
    dirty.forEach((updated, i) => {
      if (updated) {
        const curve = boundedCurve(
          raw[i],
          entries[i],
          baseline[i],
          transform,
          candidate,
          symmetric[i]
        );
        painted[i] = paintDoublet(curve, options, clearance);
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
      entries: entries.map((_, i) => candidate.links[i + 1]),
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
