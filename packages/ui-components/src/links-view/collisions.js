import { doubletCurves } from './doublet-curves.js';
import { doubletGeometry, fittedCurve } from './doublet-geometry.js';
import { doubletPairs } from './doublet-options.js';
import { rendererOptions } from './network-editor/renderer-options.js';
import { scorePaintedCollisions } from './painted-collisions.js';
import { searchState, symmetricReferences } from './collision-search-state.js';

const noGaps = () => [null, null, null, null];
const noTurn = () => [0, 0];
const epsilon = 1e-8;
const absolute = (a, b) => Math.abs(a - b);
const abort = (signal) => {
  if (signal?.aborted) {
    throw Object.assign(new Error('Solver cancelled'), { name: 'AbortError' });
  }
};

function extend(from, to, step) {
  const values = [];
  for (let v = from; v <= to; v += step) {
    values.push(v);
  }
  if (values.at(-1) !== to && from < to) {
    values.push(to);
  }
  return values;
}

function angles(base, range, step) {
  const min = Math.max(-180, base - range);
  const max = Math.min(180, base + range);
  return [
    ...new Set([
      ...extend(base, max, step),
      ...extend(0, base - min, step).map((d) => base - d),
    ]),
  ].sort((a, b) => absolute(a, base) - absolute(b, base) || a - b);
}

function movement(entries, original, field, defaults) {
  return entries.reduce(
    (cost, entry, i) =>
      entry[field].reduce(
        (sum, value, side) =>
          sum +
          absolute(
            value ?? defaults[side],
            original[i][field][side] ?? defaults[side]
          ),
        cost
      ),
    0
  );
}

function rank(
  { frame: { options }, original, signal },
  state,
  i,
  variants,
  { spacing, stopOnClean = true } = {}
) {
  const { entries } = state.current;
  let best = state.current;
  const metrics = (candidate) => [
    candidate.count,
    candidate.cost,
    movement(candidate.entries, original, 'gaps', options.gaps),
    spacing?.(candidate.entries[i].turns) ?? 0,
    movement(candidate.entries, original, 'turns', [0, 0]),
  ];
  let scores = metrics(best);
  for (const variant of variants) {
    abort(signal);
    const next = entries.slice();
    next[i] = variant;
    const candidate = state.evaluate(next, [i]);
    const values = metrics(candidate);
    const changed = values.findIndex(
      (value, j) => absolute(value, scores[j]) > epsilon
    );
    if (changed >= 0 && values[changed] < scores[changed]) {
      best = candidate;
      scores = values;
    }
    if (best.count === 0 && stopOnClean && !spacing) {
      break;
    }
  }
  if (best !== state.current) {
    state.commit(best);
    return true;
  }
  return false;
}

function turnVariants(
  context,
  state,
  i,
  { range, step, window = 0, mirrorOnly }
) {
  const entry = state.current.entries[i];
  const base = context.original[i].turns;
  const pair = context.frame.pairs[i];
  const options = context.frame.options;
  const variations = [];
  const values = (side) => {
    const grid = angles(base[side], range, options.solveStep);
    if (window) {
      const middle = entry.turns[side];
      return grid.filter(
        (a) =>
          absolute(a, middle) < window &&
          (step === options.solveStep || (a - middle) % step === 0)
      );
    }
    return angles(base[side], range, step);
  };
  if (pair[0] && pair[0] === pair[1] && pair[0] !== i + 1) {
    for (const angle of values(0)) {
      if (absolute(-angle, base[1]) <= range) {
        variations.push({ ...entry, turns: [angle, -angle] });
      }
    }
  }
  if (!mirrorOnly) {
    pair.forEach((ref, side) => {
      if (ref === 0 || ref === i + 1) {
        return;
      }
      for (const angle of values(side)) {
        const turns = [...entry.turns];
        turns[side] = angle;
        variations.push({ ...entry, turns });
      }
    });
  }
  return variations;
}

function equalGaps(variants, original, options) {
  const first = original.gaps[0] ?? options.gaps[0];
  const last = original.gaps[1] ?? options.gaps[1];
  if (first === last) {
    return variants;
  }
  return [];
}

// In a symmetrical lens, the endpoint tangents have a shared reference
// middle. Prefer equal angular sectors with the reference's tangent axis.
function spacingPenalty(frame, i) {
  const curve = frame.layoutCurves[i];
  const target = frame.layoutCurves[frame.pairs[i][0] - 1];
  const heading = (v) => (Math.atan2(v.y, v.x) * 180) / Math.PI;
  const axes = [heading(target.direction), heading(target.direction) + 180];
  const ends = [
    heading({
      x: curve.path[0].c1.x - curve.path[0].p0.x,
      y: curve.path[0].c1.y - curve.path[0].p0.y,
    }),
    heading({
      x: curve.path[1].c2.x - curve.path[1].p3.x,
      y: curve.path[1].c2.y - curve.path[1].p3.y,
    }),
  ];
  return (turns) => {
    const original = frame.options.links[i + 1]?.turns ?? [0, 0];
    const degrees = [
      ...axes,
      ...ends.map((a, side) => a + turns[side] - original[side]),
    ]
      .map((a) => (a + 720) % 360)
      .sort((a, b) => a - b);
    return degrees.reduce((sum, a, j) => {
      const span = (degrees[j + 1] ?? degrees[0] + 360) - a;
      return sum + (span - 90) ** 2;
    }, 0);
  };
}

function turnPass(context, state, range, step, window = 0, symmetric = false) {
  let edited = false;
  context.frame.pairs.some((_, i) => {
    const special = symmetricReferences(context.frame.pairs, i);
    if (symmetric && !special) {
      return false;
    }
    const { entries } = state.current;
    const { frame } = context;
    const { options } = frame;
    let variants = turnVariants(context, state, i, {
      range: special ? Math.min(range, 30) : range,
      step,
      window,
      mirrorOnly: special,
    });
    if (special) {
      variants = equalGaps(variants, entries[i], options);
    }
    edited =
      rank(context, state, i, variants, {
        spacing: special ? spacingPenalty(frame, i) : undefined,
      }) || edited;
    return state.current.count === 0 && !symmetric;
  });
  return edited;
}

function searchTurns(context, state, range, symmetric = false) {
  const { options, pairs } = context.frame;
  if (!range || !state.current.count) {
    return;
  }
  const samples = pairs.length >= 12 ? 10 : 30;
  const finest = options.solveStep;
  const step =
    pairs.length >= 3
      ? finest * Math.max(1, Math.ceil(range / (samples * finest)))
      : finest;
  for (let i = 0; i < options.passes && state.current.count; i++) {
    let changed = false;
    if (!i || step === finest || pairs.length < 12) {
      changed = turnPass(context, state, range, step, 0, symmetric);
    }
    for (let window = step; window > finest && state.current.count; ) {
      const fine = finest * Math.max(1, Math.floor(window / (3 * finest)));
      changed =
        turnPass(context, state, range, fine, window, symmetric) || changed;
      window = fine;
    }
    if (!changed) {
      break;
    }
  }
}

function searchMirrors(context, state, range) {
  if (!range || !state.current.count || context.frame.pairs.length > 2) {
    return;
  }
  const { original, frame, signal } = context;
  const { options, pairs } = frame;
  pairs.some((pair, i) => {
    if (
      pair[0] !== pair[1] ||
      !pair[0] ||
      pair[0] === i + 1 ||
      symmetricReferences(pairs, i)
    ) {
      return false;
    }
    const variants = turnVariants(context, state, i, {
      range,
      step: options.solveStep,
      mirrorOnly: true,
    });
    for (const variant of variants) {
      abort(signal);
      if (
        variant.turns.every(
          (turn, side) => absolute(turn, original[i].turns[side]) <= 30
        )
      ) {
        continue;
      }
      const next = original.slice();
      next[i] = { ...original[i], turns: variant.turns };
      const candidate = state.evaluate(next, [i]);
      if (!candidate.count) {
        state.commit(candidate);
        return true;
      }
    }
    return false;
  });
}

function gapVariants(context, state, i) {
  const pair = context.frame.pairs[i];
  const options = context.frame.options;
  const entry = state.current.entries[i];
  const special = symmetricReferences(context.frame.pairs, i);
  return [0, 1, 2, 3].flatMap((side) => {
    const ref = pair[side % 2];
    if (ref === 0 || ref === i + 1 || (special && side === 1)) {
      return [];
    }
    const middle = side >= 2;
    const range = middle ? options.solveMiddleRange : options.solveGapRange;
    if (!range) {
      return [];
    }
    const couple = special && !middle;
    const base = context.original[i].gaps[side] ?? options.gaps[side];
    const other = context.original[i].gaps[1] ?? options.gaps[1];
    const start = couple ? Math.max(base, other) : base;
    const end = Math.min(
      start + range,
      middle ? 30 : 1,
      couple ? Math.min(base, other) + range : Infinity
    );
    if (end <= start) {
      return [];
    }
    const samples = context.frame.pairs.length >= 12 ? 5 : 10;
    return Array.from({ length: samples }, (_, index) => {
      const gaps = [...entry.gaps];
      gaps[side] = start + ((end - start) * (index + 1)) / samples;
      if (couple) {
        gaps[1] = gaps[0];
      }
      return { ...entry, gaps };
    });
  });
}

function searchGaps(context, state) {
  const { options, pairs } = context.frame;
  for (let pass = 0; pass < options.passes && state.current.count; pass++) {
    let changed = false;
    pairs.some((_, i) => {
      changed =
        rank(context, state, i, gapVariants(context, state, i), {
          stopOnClean: false,
        }) || changed;
      return state.current.count === 0;
    });
    if (!changed) {
      break;
    }
  }
}

function overrides(entries, field, length, isEmpty) {
  let last = entries.length;
  while (last > length && isEmpty(entries[last - 1][field])) {
    last--;
  }
  return entries.slice(0, last).map((entry) => entry[field]);
}

function inputLengths(options, entries) {
  if (typeof options !== 'string') {
    return [options.turns?.length ?? 0, options.linkGaps?.length ?? 0];
  }
  const last = (field, empty) =>
    entries.findLastIndex((entry) =>
      entry[field].some((value) => value !== empty)
    ) + 1;
  return [last('turns', 0), last('gaps', null)];
}

function exactScore(frame, entries) {
  const options = {
    ...frame.options,
    links: Object.fromEntries(entries.map((entry, i) => [i + 1, entry])),
  };
  const curves = doubletCurves(frame.pairs, frame.places, options).map(
    (curve) => fittedCurve(curve, frame.transform, options)
  );
  return scorePaintedCollisions({ ...frame, options, curves });
}

function chooseWinner(context) {
  const { frame, original, before } = context;
  const { options } = frame;
  const near = Math.min(30, options.solveRange);
  const turns = searchState(frame, original);
  const stages = [];
  const remember = (state, stage) => {
    stages.push(state.current);
    if (options.debug) {
      globalThis.console.debug('doublet:solve', {
        stage,
        count: state.current.count,
        cost: state.current.cost,
      });
    }
  };
  searchTurns(context, turns, near, true);
  remember(turns, 'symmetry');
  searchTurns(context, turns, near);
  remember(turns, 'near turns');
  if (options.solveRange > near) {
    searchMirrors(context, turns, options.solveRange);
    searchTurns(context, turns, options.solveRange);
  }
  remember(turns, 'full turns');
  if (turns.current.count && options.solveGaps) {
    const gaps = searchState(frame, original);
    searchGaps(context, gaps);
    remember(gaps, 'gaps');
    searchTurns(context, gaps, near);
    if (options.solveRange > near) {
      searchTurns(context, gaps, options.solveRange);
    }
    remember(gaps, 'gaps then turns');
    searchGaps(context, gaps);
    remember(gaps, 'gaps then turns then gaps');
  }
  // The sort is stable: stage order breaks ties after total gap movement.
  return stages
    .filter(
      ({ count, cost }) =>
        count <= before.count &&
        cost <= before.cost + epsilon &&
        (count < before.count || cost < before.cost - epsilon)
    )
    .sort(
      (a, b) =>
        a.count - b.count ||
        movement(a.entries, original, 'gaps', options.gaps) -
          movement(b.entries, original, 'gaps', options.gaps)
    )
    .find((candidate) => {
      const score = exactScore(frame, candidate.entries);
      return score.count === candidate.count && score.cost <= before.cost;
    });
}

/** Synchronous painted clearance search. Use createCollisionSolver in a browser. */
export function solveCollisions(links, options = {}, { signal } = {}) {
  abort(signal);
  const pairs = doubletPairs(links);
  const source =
    typeof options === 'string'
      ? options
      : rendererOptions(options, pairs.length);
  const frame = doubletGeometry(pairs, source);
  const original = pairs.map(
    (_, i) =>
      frame.options.links[i + 1] ?? {
        turns: noTurn(),
        gaps: noGaps(),
      }
  );
  const before = scorePaintedCollisions(frame);
  const winner = before.count
    ? chooseWinner({ frame, original, before, signal })
    : undefined;
  const entries = winner?.entries ?? original;
  const [lastTurn, lastGap] = inputLengths(options, original);
  return {
    turns: overrides(entries, 'turns', lastTurn, (turns) =>
      turns.every((v) => v === 0)
    ),
    linkGaps: overrides(entries, 'gaps', lastGap, (gaps) =>
      gaps.every((v) => v === null)
    ),
    frame: entries === original ? frame.options.frame : frame.transform,
    delta: entries.map((entry, i) =>
      entry.turns.map((value, side) => value - original[i].turns[side])
    ),
    before: before.count,
    after: winner?.count ?? before.count,
  };
}
