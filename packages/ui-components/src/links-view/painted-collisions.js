import { distance, lerp } from './geometry.js';
import { doubletDashLengths } from './doublet-svg.js';
import {
  boxesNear,
  component,
  paintedDistance,
  paintedMarker,
  strokeDashDot,
  strokeParts,
  strokeCrossing,
  visiblePoints,
} from './painted-shapes.js';

function dashHalf(points, pattern, state, cap, joint, radius) {
  if (!pattern.length) {
    return strokeParts(points, radius, cap, joint);
  }
  const parts = [];
  let run = [];
  const flush = () => {
    parts.push(...strokeParts(run, radius, cap, joint));
    run = [];
  };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const span = distance(a, b);
    for (let length = 0; length < span; ) {
      const p = length === 0 ? a : lerp(a, b, length / span);
      if (state.remaining === 0) {
        if (state.index % 2 === 0 && !run.length) {
          const dot = strokeDashDot(p, a, b, radius, cap, joint);
          if (dot) {
            parts.push(dot);
          }
        }
        flush();
        state.index = (state.index + 1) % pattern.length;
        state.remaining = pattern[state.index];
        continue;
      }
      const step = Math.min(state.remaining, span - length);
      length += step;
      state.remaining -= step;
      if (state.index % 2 === 0) {
        if (!run.length) {
          run.push(p);
        }
        run.push(length === span ? b : lerp(a, b, length / span));
      }
    }
  }
  flush();
  return parts;
}

export function paintDoublet(curve, options, clearance) {
  const lines = curve.visible.map(visiblePoints);
  const radius = options.strokeWidth / 2;
  const joint = {
    center: curve.middle,
    radius: options.strokeWidth + clearance + options.middle.size / 2,
  };
  const pattern = doubletDashLengths(options);
  const caps = options.linecap;
  const paint = (clip) => {
    let state;
    return lines.map((line, i) => {
      const previous = i && lines[i - 1].at(-1);
      if (!previous || previous.x !== line[0]?.x || previous.y !== line[0]?.y) {
        state = { index: 0, remaining: pattern[0] };
      }
      const shape = component(
        dashHalf(line, pattern, state, caps, clip, radius)
      );
      if (shape) {
        shape.ends = [line[0], line.at(-1)];
      }
      return shape;
    });
  };
  const shafts = paint(null);
  const markers = curve.markers.map((placement) =>
    paintedMarker(placement, options)
  );
  const pieces = [...shafts, ...markers].filter(Boolean);
  const halves = paint(joint);
  let cost = measure(halves[0], halves[1], clearance, options.strokeWidth);
  let count = Number(cost > 0);
  const add = (first, second) => {
    const collision = measure(first, second, clearance, options.strokeWidth);
    cost += collision;
    count += Number(collision > 0);
  };
  for (const [i, placement] of curve.markers.entries()) {
    // A marker touches the shaft it belongs to. The opposite shaft and
    // the other markers can still obstruct it when a link folds back.
    if (placement.end === 'start' || placement.end === 'end') {
      add(markers[i], shafts[placement.end === 'start' ? 1 : 0]);
    }
    for (let j = 0; j < i; j++) {
      add(markers[i], markers[j]);
    }
  }
  return {
    pieces,
    bounds: component(pieces)?.bounds,
    own: { count, cost },
  };
}

function measure(a, b, clearance, strokeWidth) {
  if (!a || !b || !boxesNear(a.bounds, b.bounds, clearance)) {
    return 0;
  }
  let gap = Infinity,
    depth = 0,
    margin = clearance;
  for (const first of a.parts) {
    for (const second of b.parts) {
      if (!boxesNear(first.bounds, second.bounds, margin)) {
        continue;
      }
      const crossing = strokeCrossing(first, second);
      if (crossing) {
        const distanceToEnd = Math.min(
          ...[...a.ends, ...b.ends].map((p) => distance(p, crossing))
        );
        depth = Math.max(depth, distanceToEnd);
        gap = Math.min(gap, -strokeWidth);
        margin = 0;
      } else if (!depth) {
        gap = Math.min(gap, paintedDistance(first, second));
        margin = Math.max(0, Math.min(clearance, gap));
      }
    }
  }
  if (depth > 1e-8) {
    return 5 + depth / (depth + strokeWidth);
  }
  if (gap > 0 && gap >= clearance) {
    return 0;
  }
  // A single conflict per component pair. Use penetration and the remaining
  // clearance to distinguish equally numerous conflicts during the search.
  return (
    1 +
    Math.max(0, clearance - Math.max(0, gap)) / Math.max(1, clearance) +
    Math.min(2, Math.max(0, -gap) / strokeWidth)
  );
}

export function paintedPair(a, b, clearance, strokeWidth) {
  let count = 0,
    cost = 0;
  if (a.bounds && b.bounds && boxesNear(a.bounds, b.bounds, clearance)) {
    for (const first of a.pieces) {
      for (const second of b.pieces) {
        const collision = measure(first, second, clearance, strokeWidth);
        count += Number(collision > 0);
        cost += collision;
      }
    }
  }
  return { count, cost };
}

export const ownScore = ({ own }) => own;

/** Count and weight collisions in the fitted geometry returned by the renderer. */
export function scorePaintedCollisions(
  frame,
  { clearance = frame.options.clearance ?? 1 } = {}
) {
  if (!Number.isFinite(clearance) || clearance < 0 || clearance > 10) {
    throw new RangeError('clearance must be in 0..10');
  }
  const { strokeWidth } = frame.options;
  const painted = frame.curves.map((curve) =>
    paintDoublet(curve, frame.options, clearance)
  );
  let count = 0,
    cost = 0;
  for (let i = 0; i < painted.length; i++) {
    const own = ownScore(painted[i]);
    count += own.count;
    cost += own.cost;
    for (let j = 0; j < i; j++) {
      const pair = paintedPair(painted[i], painted[j], clearance, strokeWidth);
      count += pair.count;
      cost += pair.cost;
    }
  }
  return { count, cost };
}
