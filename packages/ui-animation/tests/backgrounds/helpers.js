export function environment({ dpr = 3, width = 300, height = 150 } = {}) {
  const calls = [];
  const frames = new Map();
  const listeners = new Map();
  let sequence = 0;
  let observer;
  const context = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    },
    {
      get(target, key) {
        return key in target
          ? target[key]
          : (...args) => calls.push([key, ...args]);
      },
    }
  );
  const media = {
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  };
  const win = {
    devicePixelRatio: dpr,
    requestAnimationFrame(fn) {
      frames.set(++sequence, fn);
      return sequence;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    addEventListener(name, fn) {
      listeners.set(name, fn);
    },
    removeEventListener(name) {
      listeners.delete(name);
    },
    matchMedia: () => media,
    ResizeObserver: class {
      constructor(fn) {
        observer = fn;
      }
      observe() {}
      disconnect() {
        observer = undefined;
      }
    },
    Path2D: class {
      moveTo() {}
      lineTo() {}
      closePath() {}
      arc() {}
      rect() {}
    },
  };
  const doc = {
    defaultView: win,
    hidden: false,
    addEventListener(name, fn) {
      listeners.set(name, fn);
    },
    removeEventListener(name) {
      listeners.delete(name);
    },
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => context,
      style: {},
      setAttribute() {},
      remove() {},
    }),
    head: { append() {} },
  };
  const canvas = {
    ownerDocument: doc,
    width: 300,
    height: 150,
    style: {},
    setAttribute() {},
    getContext: () => context,
    getBoundingClientRect: () => ({ width, height }),
  };
  return {
    canvas,
    calls,
    frames,
    context,
    doc,
    win,
    media,
    resize(w, h) {
      width = w;
      height = h;
      observer?.([]);
    },
    event(name) {
      listeners.get(name)?.();
    },
    tick(time) {
      const batch = [...frames.values()];
      frames.clear();
      batch.forEach((fn) => fn(time));
    },
  };
}
