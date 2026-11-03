/**
 * A recording 2D context and Path2D for the renderer tests: every call is
 * kept as `[name, ...args]` and style properties are kept in `state`.
 */

export class FakePath2D {
  constructor(d = '') {
    this.d = d;
  }
}

const STYLE_PROPERTIES = [
  'fillStyle',
  'strokeStyle',
  'lineWidth',
  'lineCap',
  'lineJoin',
];

/** A context that records calls; `state` holds the current styles. */
export function fakeContext() {
  const calls = [];
  const state = {};
  const ctx = { calls, state };
  for (const name of STYLE_PROPERTIES) {
    Object.defineProperty(ctx, name, {
      get: () => state[name],
      set: (value) => {
        state[name] = value;
        calls.push([`set:${name}`, value]);
      },
    });
  }
  return new Proxy(ctx, {
    get(target, name) {
      if (name in target) {
        return target[name];
      }
      return (...args) => {
        calls.push([name, ...args]);
      };
    },
  });
}
