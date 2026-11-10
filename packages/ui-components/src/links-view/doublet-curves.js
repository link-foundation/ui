import {
  add,
  sub,
  scale,
  distance,
  segmentLength,
  cubicPoint,
  cubicDerivative,
  lerp,
} from './geometry.js';
import { rotate, unit } from './doublet-layout.js';

function direction(pair, id, positions, o) {
  const m = positions.get(id),
    [s, t] = pair;
  const incoming = s && s !== id ? unit(sub(m, positions.get(s))) : null;
  const outgoing = t && t !== id ? unit(sub(positions.get(t), m)) : null;
  if (incoming && outgoing) {
    // Cancelled chords (both references on one side, as in `2 2` and `1 1`)
    // turn a quarter from the chord that runs from the higher ID to the lower
    // one, so links that reference each other share a single middle direction.
    const [high, low] = s > id ? [s, id] : [id, s];
    const across = rotate(
      unit(sub(positions.get(low), positions.get(high))),
      90
    );
    return unit(add(incoming, outgoing), across);
  }
  if (incoming || outgoing) {
    return rotate(incoming ?? outgoing, o.bulge);
  }
  return unit(m, rotate({ x: 1, y: 0 }, o.rotation));
}
function endDirection(chord, tangent, o, side, same, turn) {
  const a = (Math.atan2(chord.y, chord.x) * 180) / Math.PI;
  const mid = (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI;
  // The mirror end (a lens for two references to one link), in degrees from
  // the chord. Fixed angles turn the chord to the same side as this mirror.
  const offset = a - mid;
  const mirror = same
    ? Math.sin((offset * Math.PI) / 180) < 0
      ? -45
      : 45
    : offset;
  if (o.angles === 'mirror') {
    return rotate(chord, mirror + turn);
  }
  const across = chord.x * tangent.y - chord.y * tangent.x;
  if (Math.abs(across) < 1e-10) {
    return rotate(chord, turn);
  }
  const toward = Math.sin((mirror * Math.PI) / 180) < 0 ? -1 : 1;
  return rotate(
    chord,
    toward * (side === 0 ? o.sourceAngle : o.targetAngle) + turn
  );
}
function half({ m, dir, ref, id, side, pair, positions, o, turn, n }) {
  const sign = side === 0 ? -1 : 1;
  if (ref === id) {
    const radius = (n === 1 ? 1.25 : 0.8) * o.loop;
    const width = Math.exp((o.bulge + o.loopBend) / 180);
    const along = scale(dir, radius),
      sideways = scale(rotate(dir, 90), radius * width);
    return side === 0
      ? { p0: m, c1: add(m, rotate(sideways, turn)), c2: sub(m, along), p3: m }
      : { p0: m, c1: add(m, along), c2: sub(m, rotate(sideways, turn)), p3: m };
  }
  const end =
    ref === 0
      ? add(m, scale(dir, sign * (n === 1 ? 0.9 : 0.42) * o.free))
      : positions.get(ref);
  const chord = unit(side === 0 ? sub(m, end) : sub(end, m), dir);
  const handle = o.tension * distance(m, end);
  const endDir =
    ref === 0
      ? rotate(dir, turn)
      : endDirection(chord, dir, o, side, pair[0] === pair[1], turn);
  return side === 0
    ? {
        p0: end,
        c1: add(end, scale(endDir, handle)),
        c2: sub(m, scale(dir, handle)),
        p3: m,
      }
    : {
        p0: m,
        c1: add(m, scale(dir, handle)),
        c2: sub(end, scale(endDir, handle)),
        p3: end,
      };
}

/** Every link owns its middle, including self-reference and free ends. */
export function doubletCurves(pairs, positions, o) {
  const curves = pairs.map((pair, i) => {
    const id = i + 1,
      m = positions.get(id),
      dir = direction(pair, id, positions, o);
    const turns = o.links[id]?.turns ?? [0, 0];
    const path = pair.map((ref, side) =>
      half({
        m,
        dir,
        ref,
        id,
        side,
        pair,
        positions,
        o,
        turn: turns[side],
        n: pairs.length,
      })
    );
    // Ends at another link's middle; their start/end gaps back off along the
    // end tangent when fitted.
    const references = pair.map((ref) => ref !== 0 && ref !== id);
    return { id, middle: m, direction: dir, path, references };
  });
  bendOverlaps(curves, pairs, o);
  return curves;
}
function bendOverlaps(curves, pairs, o) {
  // A neutral collinear half is identified geometrically, independent of IDs.
  const seen = new Map();
  curves.forEach((curve, i) =>
    curve.path.forEach((s, side) => {
      const ref = pairs[i][side];
      if (!ref || ref === i + 1 || o.links[i + 1]?.turns[side]) {
        return;
      }
      const chord = sub(s.p3, s.p0),
        a = sub(s.c1, s.p0),
        b = sub(s.c2, s.p0);
      if (
        Math.abs(chord.x * a.y - chord.y * a.x) > 1e-9 ||
        Math.abs(chord.x * b.y - chord.y * b.x) > 1e-9
      ) {
        return;
      }
      const key = [Math.min(i + 1, ref), Math.max(i + 1, ref)].join(':');
      const group = seen.get(key) ?? [];
      group.push({ s, side });
      seen.set(key, group);
    })
  );
  for (const group of seen.values()) {
    if (group.length < 2) {
      continue;
    }
    for (const { s, side } of group) {
      if (side === 0) {
        s.c1 = add(s.p0, rotate(sub(s.c1, s.p0), 45));
      } else {
        s.c2 = add(s.p3, rotate(sub(s.c2, s.p3), 45));
      }
    }
  }
}

/** Bounded arc-length inversion using the shared quadrature. */
export function parameterAtDistance(s, length) {
  const total = segmentLength(s);
  if (length <= 0 || total === 0) {
    return 0;
  }
  if (length >= total) {
    return 1;
  }
  let lo = 0,
    hi = 1,
    t = length / total;
  for (let i = 0; i < 32; i++) {
    const error = segmentLength(s, t) - length;
    if (Math.abs(error) < 1e-9) {
      break;
    }
    if (error > 0) {
      hi = t;
    } else {
      lo = t;
    }
    const d = cubicDerivative(s, t),
      speed = Math.hypot(d.x, d.y),
      next = t - error / speed;
    t = next > lo && next < hi ? next : (lo + hi) / 2;
  }
  return t;
}
function split(s, t) {
  const a = lerp(s.p0, s.c1, t),
    b = lerp(s.c1, s.c2, t),
    c = lerp(s.c2, s.p3, t);
  const d = lerp(a, b, t),
    e = lerp(b, c, t),
    m = lerp(d, e, t);
  return [
    { p0: s.p0, c1: a, c2: d, p3: m },
    { p0: m, c1: e, c2: c, p3: s.p3 },
  ];
}
export function trimCubic(s, start, end) {
  const length = segmentLength(s);
  if (start + end >= length || length < 1e-12) {
    return null;
  }
  if (start === 0 && end === 0) {
    return s;
  }
  const t0 = parameterAtDistance(s, start),
    t1 = parameterAtDistance(s, length - end);
  return split(split(s, t1)[0], t0 / t1)[1];
}

/** Sample along the uncut curve; out-of-range offsets extend its end tangent. */
export function curveAtDistance(path, length) {
  const lengths = path.map((s) => segmentLength(s)),
    total = lengths[0] + lengths[1];
  if (length < 0 || length > total) {
    const side = length < 0 ? 0 : 1,
      t = side === 0 ? 0 : 1,
      s = path[side];
    const dir = unit(cubicDerivative(s, t), unit(sub(s.p3, s.p0)));
    return {
      point: add(
        t === 0 ? s.p0 : s.p3,
        scale(dir, length < 0 ? length : length - total)
      ),
      direction: dir,
    };
  }
  const side = length <= lengths[0] ? 0 : 1,
    s = path[side];
  const t = parameterAtDistance(s, length - (side ? lengths[0] : 0));
  return {
    point: cubicPoint(s, t),
    direction: unit(cubicDerivative(s, t), unit(sub(s.p3, s.p0))),
  };
}
