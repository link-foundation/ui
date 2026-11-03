/**
 * Behaviour: zoom and pan belong to one element. Every listener is added to
 * that element (never to document or window), a drag keeps going through
 * pointer capture, and `destroy()` removes every listener it added.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  createZoomPan,
  wheelDelta,
  wheelFactor,
} from '../../src/links-view/zoom-pan.js';

/** An element that records listeners and pointer capture. */
function fakeElement({ width = 200, height = 100 } = {}) {
  const listeners = new Map();
  const captured = new Set();
  return {
    listeners,
    captured,
    addEventListener(type, fn, options) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push({ fn, options });
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) ?? [];
      listeners.set(
        type,
        list.filter((l) => l.fn !== fn)
      );
    },
    dispatch(type, event) {
      for (const { fn } of listeners.get(type) ?? []) {
        fn({ type, preventDefault() {}, ...event });
      }
    },
    count() {
      return [...listeners.values()].reduce((n, list) => n + list.length, 0);
    },
    getBoundingClientRect: () => ({ left: 10, top: 20, width, height }),
    setPointerCapture: (id) => captured.add(id),
    hasPointerCapture: (id) => captured.has(id),
    releasePointerCapture: (id) => captured.delete(id),
  };
}

const near = (a, b) => expect(Math.abs(a - b) < 1e-9).toBe(true);

describe('wheel zoom', () => {
  it('zooms by 0.999 ** delta', () => {
    expect(wheelFactor(0)).toBe(1);
    near(wheelFactor(100), 0.999 ** 100);
    near(wheelFactor(-100), 0.999 ** -100);
    expect(wheelDelta({ deltaY: 3, deltaMode: 1 })).toBe(72);
    expect(wheelDelta({ deltaY: 3, deltaMode: 0 })).toBe(3);
  });

  it('zooms around the pointer and asks to keep the page still', () => {
    const element = fakeElement();
    const changes = [];
    const zoom = createZoomPan(element, {
      onChange: (view, cause) => changes.push({ view, cause }),
    });
    let prevented = false;
    element.dispatch('wheel', {
      deltaY: -200,
      deltaMode: 0,
      clientX: 60,
      clientY: 70,
      preventDefault: () => {
        prevented = true;
      },
    });
    const k = 0.999 ** -200;
    const view = zoom.get();
    near(view.k, k);
    // The pointer (50, 50 inside the element) stays on the same content point.
    near(view.x, 50 - 50 * k);
    near(view.y, 50 - 50 * k);
    expect(prevented).toBe(true);
    expect(changes.length).toBe(1);
    expect(changes[0].cause).toBe('wheel');
  });

  it('clamps the zoom to min and max', () => {
    const zoom = createZoomPan(fakeElement(), { min: 0.5, max: 2 });
    expect(zoom.zoomBy(100).k).toBe(2);
    expect(zoom.zoomBy(0.0001).k).toBe(0.5);
    expect(zoom.set({ k: 50 }).k).toBe(2);
    expect(() => createZoomPan(fakeElement(), { min: 0 })).toThrow(RangeError);
  });

  it('uses 0.1 and 20 as the default limits', () => {
    const zoom = createZoomPan(fakeElement());
    expect(zoom.zoomBy(1e6).k).toBe(20);
    expect(zoom.zoomBy(1e-9).k).toBe(0.1);
  });
});

describe('drag and pinch', () => {
  it('pans with a captured drag', () => {
    const element = fakeElement();
    const zoom = createZoomPan(element);
    element.dispatch('pointerdown', {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 10,
      clientY: 20,
    });
    expect(element.captured.has(1)).toBe(true);
    element.dispatch('pointermove', { pointerId: 1, clientX: 40, clientY: 5 });
    expect(zoom.get()).toEqual({ x: 30, y: -15, k: 1 });
    element.dispatch('pointerup', { pointerId: 1 });
    expect(element.captured.has(1)).toBe(false);
    element.dispatch('pointermove', { pointerId: 1, clientX: 99, clientY: 99 });
    expect(zoom.get()).toEqual({ x: 30, y: -15, k: 1 });
  });

  it('ignores the right mouse button', () => {
    const element = fakeElement();
    const zoom = createZoomPan(element);
    element.dispatch('pointerdown', {
      pointerId: 1,
      pointerType: 'mouse',
      button: 2,
      clientX: 0,
      clientY: 0,
    });
    element.dispatch('pointermove', { pointerId: 1, clientX: 50, clientY: 0 });
    expect(zoom.get()).toEqual({ x: 0, y: 0, k: 1 });
  });

  it('zooms with two fingers', () => {
    const element = fakeElement();
    const zoom = createZoomPan(element);
    const down = (pointerId, clientX) =>
      element.dispatch('pointerdown', {
        pointerId,
        pointerType: 'touch',
        clientX,
        clientY: 70,
      });
    down(1, 50);
    down(2, 70);
    element.dispatch('pointermove', { pointerId: 2, clientX: 90, clientY: 70 });
    near(zoom.get().k, 2);
  });
});

describe('keyboard-style helpers', () => {
  it('zooms around the middle, pans and resets', () => {
    const zoom = createZoomPan(fakeElement({ width: 200, height: 100 }));
    const v = zoom.zoomBy(2);
    expect(v).toEqual({ x: -100, y: -50, k: 2 });
    expect(zoom.panBy(5, 6)).toEqual({ x: -95, y: -44, k: 2 });
    expect(zoom.reset()).toEqual({ x: 0, y: 0, k: 1 });
  });
});

describe('listeners', () => {
  it('adds every listener to the element only', () => {
    const element = fakeElement();
    const documentLike = fakeElement();
    const original = globalThis.document;
    globalThis.document = documentLike;
    try {
      createZoomPan(element);
    } finally {
      globalThis.document = original;
    }
    expect(documentLike.count()).toBe(0);
    expect([...element.listeners.keys()].sort()).toEqual([
      'lostpointercapture',
      'pointercancel',
      'pointerdown',
      'pointermove',
      'pointerup',
      'wheel',
    ]);
    expect(element.listeners.get('wheel')[0].options).toEqual({
      passive: false,
    });
  });

  it('destroy removes every listener it added', () => {
    const element = fakeElement();
    const zoom = createZoomPan(element);
    expect(element.count()).toBe(6);
    zoom.destroy();
    expect(element.count()).toBe(0);
    zoom.destroy();
    expect(element.count()).toBe(0);
  });

  it('two elements zoom independently', () => {
    const a = fakeElement();
    const b = fakeElement();
    const za = createZoomPan(a);
    const zb = createZoomPan(b);
    a.dispatch('wheel', { deltaY: -500, deltaMode: 0, clientX: 0, clientY: 0 });
    expect(za.get().k > 1).toBe(true);
    expect(zb.get()).toEqual({ x: 0, y: 0, k: 1 });
  });

  it('can leave the wheel alone', () => {
    const element = fakeElement();
    createZoomPan(element, { wheel: false });
    expect(element.listeners.has('wheel')).toBe(false);
  });
});
