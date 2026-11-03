/**
 * Easing functions: cubic-bezier, steps, closed-form springs and the CSS
 * `linear()` of any easing.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  cubicBezier,
  easingCss,
  easingFunction,
  spring,
  springEasing,
  steps,
  toCssLinear,
  SPRING_TOLERANCE,
} from '@link-foundation/ui-animation';

const near = (actual, expected, epsilon = 1e-6) =>
  expect(Math.abs(actual - expected) <= epsilon).toBe(true);

describe('cubicBezier', () => {
  it('is fixed at 0 and 1', () => {
    const ease = cubicBezier(0.2, 0, 0, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  it('is the identity for (0 0 1 1) and symmetric for ease-in-out', () => {
    const identity = cubicBezier(0, 0, 1, 1);
    for (const x of [0.1, 0.25, 0.5, 0.9]) {
      near(identity(x), x);
    }
    const inOut = cubicBezier(0.42, 0, 0.58, 1);
    near(inOut(0.5), 0.5);
    near(inOut(0.3) + inOut(0.7), 1);
  });

  it('matches the CSS ease curve', () => {
    // Reference values of cubic-bezier(0.25, 0.1, 0.25, 1).
    const ease = cubicBezier(0.25, 0.1, 0.25, 1);
    near(ease(0.5), 0.8024033877399112, 1e-5);
  });
});

describe('steps', () => {
  it('jumps at the end of each step by default', () => {
    const two = steps(2);
    expect([0, 0.25, 0.5, 0.75, 1].map(two)).toEqual([0, 0, 0.5, 0.5, 1]);
  });

  it('supports start, both and none', () => {
    expect(steps(2, 'start')(0.25)).toBe(0.5);
    expect(steps(1, 'both')(0.5)).toBe(0.5);
    expect(steps(3, 'none')(0.5)).toBe(0.5);
  });
});

describe('spring', () => {
  const springs = [
    { stiffness: 300, damping: 20, mass: 1 },
    { stiffness: 100, damping: 10, mass: 1 },
    { stiffness: 170, damping: 26, mass: 1 },
    { stiffness: 100, damping: 20, mass: 1 }, // critically damped
    { stiffness: 100, damping: 40, mass: 2 }, // overdamped
  ];

  it('is within 0.1% of its target at and after its settle time', () => {
    for (const options of springs) {
      const s = spring(options);
      expect(Number.isFinite(s.settleTime)).toBe(true);
      for (const extra of [0, 1, 10, 100, 1000]) {
        expect(Math.abs(1 - s.at(s.settleTime + extra)) <= 0.001).toBe(true);
      }
      expect(SPRING_TOLERANCE <= 0.001).toBe(true);
    }
  });

  it('starts at 0 and overshoots when underdamped', () => {
    const s = spring({ stiffness: 300, damping: 10, mass: 1 });
    expect(s.at(0)).toBe(0);
    let peak = 0;
    for (let t = 0; t <= s.settleTime; t += 5) {
      peak = Math.max(peak, s.at(t));
    }
    expect(peak > 1).toBe(true);
  });

  it('has no settle time without damping and rejects bad parameters', () => {
    expect(spring({ stiffness: 100, damping: 0, mass: 1 }).settleTime).toBe(
      Infinity
    );
    expect(() => spring({ stiffness: 0 })).toThrow();
  });

  it('maps progress 0..1 over the settle time', () => {
    const s = spring({ stiffness: 300, damping: 20, mass: 1 });
    const ease = springEasing(s);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    near(ease(0.5), s.at(s.settleTime / 2));
  });
});

/** The stops of a `linear(...)` text, or `null` when it is not one. */
function linearStops(css) {
  if (!css.startsWith('linear(') || !css.endsWith(')')) {
    return null;
  }
  const stops = css.slice('linear('.length, -1).split(', ').map(Number);
  return stops.every((n) => Number.isFinite(n)) ? stops : null;
}

describe('toCssLinear', () => {
  it('returns a valid linear(...) with samples + 1 stops', () => {
    const css = toCssLinear(
      springEasing(spring({ stiffness: 300, damping: 20, mass: 1 }))
    );
    const stops = linearStops(css);
    expect(stops === null).toBe(false);
    expect(stops.length).toBe(41);
    expect(stops[0]).toBe(0);
    expect(stops[40]).toBe(1);
  });

  it('honours the sample count and rounds to 4 decimals', () => {
    const css = toCssLinear((t) => t * t, 4);
    expect(css).toBe('linear(0, 0.0625, 0.25, 0.5625, 1)');
  });
});

describe('easingFunction and easingCss', () => {
  it('reads named easings from tokens, then from the built-in table', () => {
    const token = { type: 'cubicBezier', value: [0.3, 0, 0.8, 0.15] };
    const resolve = (path) =>
      path === 'motion.easing.custom' ? token : undefined;
    expect(easingCss({ type: 'named', name: 'custom' }, resolve)).toBe(
      'cubic-bezier(0.3, 0, 0.8, 0.15)'
    );
    expect(easingCss({ type: 'named', name: 'standard' })).toBe(
      'cubic-bezier(0.2, 0, 0, 1)'
    );
    expect(easingCss(null)).toBe('linear');
  });

  it('writes steps and springs as CSS', () => {
    expect(easingCss({ type: 'steps', count: 3, position: 'start' })).toBe(
      'steps(3, jump-start)'
    );
    const springCss = easingCss({
      type: 'spring',
      stiffness: 300,
      damping: 20,
      mass: 1,
    });
    expect(linearStops(springCss).length).toBe(41);
  });

  it('turns hold into a single step', () => {
    const hold = easingFunction({ type: 'named', name: 'hold' });
    expect([0, 0.5, 0.99, 1].map(hold)).toEqual([0, 0, 0, 1]);
  });
});
