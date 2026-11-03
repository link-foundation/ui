/**
 * Easing functions: `cubicBezier`, `steps`, a closed-form `spring` and
 * `toCssLinear`, plus the named easings and the conversion of a model easing
 * (`{ type: 'cubic-bezier', points }`, ...) into a function or CSS text.
 *
 * An easing function maps progress 0..1 to eased progress; it is pure.
 */

import { unwrapToken } from './tokens.js';

/** Cubic-bezier points of the named easings (ui-core / Material 3 names). */
export const NAMED_EASINGS = Object.freeze({
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  standard: [0.2, 0, 0, 1],
  emphasized: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0, 1],
  accelerate: [0.3, 0, 1, 1],
});

/** Named step easings (CSS `step-start`, `step-end`, and `hold`). */
const NAMED_STEPS = Object.freeze({
  'step-start': { count: 1, position: 'start' },
  'step-end': { count: 1, position: 'end' },
  hold: { count: 1, position: 'end' },
});

/** Whether `name` is a built-in easing name. */
export const isEasingName = (name) =>
  Object.hasOwn(NAMED_EASINGS, name) || Object.hasOwn(NAMED_STEPS, name);

export const linear = (t) => t;

/**
 * The CSS `cubic-bezier(x1, y1, x2, y2)` timing function. `x1` and `x2` must
 * be in 0..1 (as in CSS); `y` may overshoot.
 * @returns {(t: number) => number}
 */
export function cubicBezier(x1, y1, x2, y2) {
  for (const x of [x1, x2]) {
    if (!(x >= 0 && x <= 1)) {
      throw new RangeError('cubic-bezier x1 and x2 must be in 0..1');
    }
  }
  if (x1 === y1 && x2 === y2) {
    return linear;
  }
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const curveX = (s) => ((ax * s + bx) * s + cx) * s;
  const curveY = (s) => ((ay * s + by) * s + cy) * s;
  const slopeX = (s) => (3 * ax * s + 2 * bx) * s + cx;

  /** The curve parameter `s` whose x is `x` (Newton, then bisection). */
  function solve(x) {
    let s = x;
    for (let i = 0; i < 8; i++) {
      const error = curveX(s) - x;
      if (Math.abs(error) < 1e-7) {
        return s;
      }
      const slope = slopeX(s);
      if (Math.abs(slope) < 1e-6) {
        break;
      }
      s -= error / slope;
    }
    let low = 0;
    let high = 1;
    s = x;
    for (let i = 0; i < 64 && high - low > 1e-9; i++) {
      if (curveX(s) < x) {
        low = s;
      } else {
        high = s;
      }
      s = (low + high) / 2;
    }
    return s;
  }

  return (t) => {
    if (t <= 0) {
      return t < 0 && x1 > 0 ? (y1 / x1) * t : 0;
    }
    if (t >= 1) {
      return 1;
    }
    return curveY(solve(t));
  };
}

/**
 * The CSS `steps(n, position)` timing function.
 * @param {number} n  the number of steps, a positive integer
 * @param {'start'|'end'|'both'|'none'} [position]  `jump-start`, `jump-end`
 *   (the default), `jump-both` or `jump-none`
 * @returns {(t: number) => number}
 */
export function steps(n, position = 'end') {
  if (!Number.isInteger(n) || n < 1 || (position === 'none' && n < 2)) {
    throw new RangeError('steps needs a positive integer count');
  }
  const jumps = { start: n, end: n, both: n + 1, none: n - 1 }[position];
  if (jumps === undefined) {
    throw new RangeError(`unknown steps position "${position}"`);
  }
  const startsHigh = position === 'start' || position === 'both';
  return (t) => {
    if (t >= 1) {
      return 1;
    }
    if (t < 0) {
      return 0;
    }
    const step = Math.floor(t * n) + (startsHigh ? 1 : 0);
    return Math.min(step, jumps) / jumps;
  };
}

/** A spring is settled when it stays within this distance of its target. */
export const SPRING_TOLERANCE = 0.0005;

/**
 * A damped spring from 0 to 1, solved in closed form (no simulation): the
 * displacement of a mass on a spring released at rest.
 *
 * Time is in milliseconds; the physics uses seconds (stiffness in N/m,
 * damping in N·s/m, mass in kg).
 * - underdamped (ζ < 1): `1 - e^(-ζωt) (cos ω_d t + ζω/ω_d sin ω_d t)`
 * - critically damped (ζ = 1): `1 - e^(-ωt) (1 + ωt)`
 * - overdamped (ζ > 1): `1 - (r2 e^(r1 t) - r1 e^(r2 t)) / (r2 - r1)`
 *
 * `settleTime` is the first time (ms, rounded up) after which the spring
 * stays within {@link SPRING_TOLERANCE} (0.05%) of 1; it is `Infinity`
 * without damping.
 * @param {{ stiffness?: number, damping?: number, mass?: number }} [options]
 * @returns {{ at: (tMs: number) => number, settleTime: number }}
 */
export function spring({ stiffness = 100, damping = 10, mass = 1 } = {}) {
  if (!(stiffness > 0) || !(mass > 0) || !(damping >= 0)) {
    throw new RangeError(
      'spring needs stiffness > 0, mass > 0 and damping >= 0'
    );
  }
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const displacement = springDisplacement(omega, zeta);
  const at = (tMs) => (tMs <= 0 ? 0 : displacement(tMs / 1000));
  return { at, settleTime: springSettleTime(omega, zeta, displacement) };
}

function springDisplacement(omega, zeta) {
  if (zeta < 1) {
    const decay = zeta * omega;
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    return (t) =>
      1 -
      Math.exp(-decay * t) *
        (Math.cos(omegaD * t) + (decay / omegaD) * Math.sin(omegaD * t));
  }
  if (zeta === 1) {
    return (t) => 1 - Math.exp(-omega * t) * (1 + omega * t);
  }
  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega * (zeta - root);
  const r2 = -omega * (zeta + root);
  return (t) => 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

function springSettleTime(omega, zeta, displacement) {
  if (zeta === 0) {
    return Infinity;
  }
  if (zeta < 1) {
    // |1 - x(t)| <= e^(-ζωt) / sqrt(1 - ζ²): the envelope bounds the error.
    const amplitude = 1 / Math.sqrt(1 - zeta * zeta);
    const seconds = Math.log(amplitude / SPRING_TOLERANCE) / (zeta * omega);
    return Math.ceil(Math.max(0, seconds) * 1000);
  }
  // Critically damped and overdamped springs approach 1 monotonically.
  const settled = (seconds) => 1 - displacement(seconds) <= SPRING_TOLERANCE;
  let high = 1 / omega;
  while (!settled(high)) {
    high *= 2;
  }
  let low = 0;
  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2;
    if (settled(middle)) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return Math.ceil(high * 1000);
}

/**
 * A spring as an easing over its settle time: progress `x` is the time
 * `x * settleTime`, and the end (x >= 1) is exactly 1.
 * @param {{ at: (tMs: number) => number, settleTime: number }} s
 * @returns {(x: number) => number}
 */
export function springEasing(s) {
  const span = Number.isFinite(s.settleTime) ? s.settleTime : 1000;
  return (x) => (x >= 1 ? 1 : s.at(x * span));
}

/** A number as short CSS text (at most 4 decimals, no trailing zeros). */
export function cssNumber(n) {
  const rounded = Math.round(n * 10000) / 10000;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/**
 * The CSS `linear()` easing that follows `fn`: `samples + 1` evenly spaced
 * points from progress 0 to 1, `linear(0, 0.0123, ..., 1)`.
 * @param {(t: number) => number} fn
 * @param {number} [samples]
 * @returns {string}
 */
export function toCssLinear(fn, samples = 40) {
  if (!Number.isInteger(samples) || samples < 1) {
    throw new RangeError('toCssLinear needs a positive integer sample count');
  }
  const points = [];
  for (let i = 0; i <= samples; i++) {
    points.push(cssNumber(fn(i / samples)));
  }
  return `linear(${points.join(', ')})`;
}

/**
 * The easing of a named token: `resolveToken('motion.easing.NAME')` when it
 * gives a cubic-bezier, else the built-in table.
 * @returns {import('./types.js').Easing|null}
 */
export function resolveNamedEasing(name, resolveToken) {
  const token = resolveToken?.(`motion.easing.${name}`);
  const points = tokenBezier(token);
  if (points) {
    return { type: 'cubic-bezier', points };
  }
  if (Object.hasOwn(NAMED_EASINGS, name)) {
    return { type: 'cubic-bezier', points: [...NAMED_EASINGS[name]] };
  }
  if (Object.hasOwn(NAMED_STEPS, name)) {
    return { type: 'steps', ...NAMED_STEPS[name] };
  }
  return null;
}

/** The points of a cubic-bezier token (typed or raw), or `null`. */
function tokenBezier(token) {
  const typed = unwrapToken(token);
  const value = typed?.type === 'cubicBezier' ? typed.value : typed;
  return Array.isArray(value) &&
    value.length === 4 &&
    value.every((n) => typeof n === 'number')
    ? value
    : null;
}

/**
 * A model easing as a function of progress 0..1.
 * @param {import('./types.js').Easing|null|undefined} easing
 * @param {(path: string) => unknown} [resolveToken]
 * @returns {(t: number) => number}
 */
export function easingFunction(easing, resolveToken) {
  switch (easing?.type) {
    case undefined:
    case 'linear':
      return linear;
    case 'named': {
      const named = resolveNamedEasing(easing.name, resolveToken);
      return named ? easingFunction(named) : linear;
    }
    case 'cubic-bezier':
      return cubicBezier(...easing.points);
    case 'steps':
      return steps(easing.count, easing.position);
    case 'spring':
      return springEasing(spring(easing));
    default:
      return linear;
  }
}

/**
 * A model easing as CSS text for WAAPI: `linear`, `cubic-bezier(a, b, c, d)`,
 * `steps(n, jump-end)` or (springs) `linear(...)`.
 * @param {import('./types.js').Easing|null|undefined} easing
 * @param {(path: string) => unknown} [resolveToken]
 * @returns {string}
 */
export function easingCss(easing, resolveToken) {
  switch (easing?.type) {
    case undefined:
    case 'linear':
      return 'linear';
    case 'named': {
      const named = resolveNamedEasing(easing.name, resolveToken);
      return named ? easingCss(named) : 'linear';
    }
    case 'cubic-bezier': {
      const [a, b, c, d] = easing.points;
      return a === b && c === d
        ? 'linear'
        : `cubic-bezier(${easing.points.join(', ')})`;
    }
    case 'steps':
      return `steps(${easing.count}, jump-${easing.position ?? 'end'})`;
    case 'spring':
      return toCssLinear(springEasing(spring(easing)));
    default:
      return 'linear';
  }
}
