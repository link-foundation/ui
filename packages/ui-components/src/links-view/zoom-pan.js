/**
 * `createZoomPan(element, options)`: wheel zoom, drag pan and two-finger
 * pinch for one element. Every listener is added to the element itself (a
 * drag keeps receiving moves through pointer capture), never to `document`
 * or `window`, so two views on a page zoom independently, and `destroy()`
 * removes all of them.
 *
 * The view maps a point `p` of the content to `p · k + (x, y)` on the
 * element. A wheel step of `delta` pixels zooms by `0.999 ** delta` around
 * the pointer (links-visuals); a line step counts as 24 pixels.
 */

/**
 * @typedef {{x: number, y: number, k: number}} View
 * @typedef {object} ZoomPanOptions
 * @property {number} [min]  the smallest zoom (default 0.1)
 * @property {number} [max]  the largest zoom (default 20)
 * @property {View} [initial]  default `{x: 0, y: 0, k: 1}`
 * @property {(view: View, cause: string) => void} [onChange]
 * @property {boolean} [wheel]  zoom with the wheel (default true)
 * @property {(message: string, data?: object) => void} [debug]  traces
 *   every event (off by default)
 * @typedef {object} ZoomPan
 * @property {() => View} get
 * @property {(view: Partial<View>) => View} set  the zoom is clamped
 * @property {() => View} reset  back to the initial view
 * @property {(factor: number, pivot?: {x: number, y: number}) => View} zoomBy
 *   the pivot stays in place (default: the middle of the element)
 * @property {(dx: number, dy: number) => View} panBy
 * @property {() => void} destroy
 */

/** Pixels per wheel step for `deltaMode` 0 (pixels), 1 (lines), 2 (pages). */
const DELTA_SCALE = Object.freeze([1, 24, 800]);

/** The zoom factor of a wheel delta in pixels. */
export const wheelFactor = (delta) => 0.999 ** delta;

/** The wheel delta of an event in pixels. */
export const wheelDelta = (event) =>
  event.deltaY * (DELTA_SCALE[event.deltaMode ?? 0] ?? 1);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** The position of an event relative to the element's top-left corner. */
function localPoint(element, event) {
  const rect = element.getBoundingClientRect?.() ?? { left: 0, top: 0 };
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/** The middle of the element (the keyboard zoom pivot). */
function middle(element) {
  const rect = element.getBoundingClientRect?.() ?? { width: 0, height: 0 };
  return { x: rect.width / 2, y: rect.height / 2 };
}

/**
 * Make an element zoomable and pannable.
 * @param {HTMLElement} element
 * @param {ZoomPanOptions} [options]
 * @returns {ZoomPan}
 */
export function createZoomPan(element, options = {}) {
  const { min = 0.1, max = 20, onChange, debug } = options;
  if (!(min > 0 && max >= min)) {
    throw new RangeError('createZoomPan: needs 0 < min <= max');
  }
  const initial = { x: 0, y: 0, k: 1, ...options.initial };
  initial.k = clamp(initial.k, min, max);
  let view = { ...initial };
  /** @type {Map<number, {x: number, y: number}>} */
  const pointers = new Map();
  let destroyed = false;

  const emit = (next, cause) => {
    const changed = next.x !== view.x || next.y !== view.y || next.k !== view.k;
    view = next;
    if (changed) {
      debug?.('change', { view: { ...view }, cause });
      onChange?.({ ...view }, cause);
    }
    return { ...view };
  };

  const zoomBy = (factor, pivot = middle(element), cause = 'zoom') => {
    const k = clamp(view.k * factor, min, max);
    const ratio = k / view.k;
    return emit(
      {
        x: pivot.x - (pivot.x - view.x) * ratio,
        y: pivot.y - (pivot.y - view.y) * ratio,
        k,
      },
      cause
    );
  };

  const panBy = (dx, dy, cause = 'pan') =>
    emit({ x: view.x + dx, y: view.y + dy, k: view.k }, cause);

  const onWheel = (event) => {
    const delta = wheelDelta(event);
    debug?.('wheel', { delta });
    if (delta === 0) {
      return;
    }
    event.preventDefault();
    zoomBy(wheelFactor(delta), localPoint(element, event), 'wheel');
  };

  /** The middle and spread of the two first pointers (a pinch). */
  const pinch = () => {
    const [a, b] = [...pointers.values()];
    return {
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      spread: Math.hypot(b.x - a.x, b.y - a.y),
    };
  };

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    pointers.set(event.pointerId, localPoint(element, event));
    element.setPointerCapture?.(event.pointerId);
    debug?.('pointerdown', { id: event.pointerId, count: pointers.size });
  };

  const onPointerMove = (event) => {
    const last = pointers.get(event.pointerId);
    if (last === undefined) {
      return;
    }
    const now = localPoint(element, event);
    if (pointers.size >= 2) {
      const before = pinch();
      pointers.set(event.pointerId, now);
      const after = pinch();
      if (before.spread > 0) {
        zoomBy(after.spread / before.spread, after.center, 'pinch');
      }
      panBy(
        (after.center.x - before.center.x) / 2,
        (after.center.y - before.center.y) / 2,
        'pinch'
      );
      return;
    }
    pointers.set(event.pointerId, now);
    panBy(now.x - last.x, now.y - last.y, 'drag');
  };

  const onPointerEnd = (event) => {
    if (!pointers.delete(event.pointerId)) {
      return;
    }
    if (element.hasPointerCapture?.(event.pointerId)) {
      element.releasePointerCapture?.(event.pointerId);
    }
    debug?.('pointerup', { id: event.pointerId, count: pointers.size });
  };

  const listeners = [
    ['pointerdown', onPointerDown],
    ['pointermove', onPointerMove],
    ['pointerup', onPointerEnd],
    ['pointercancel', onPointerEnd],
    ['lostpointercapture', onPointerEnd],
  ];
  if (options.wheel !== false) {
    listeners.push(['wheel', onWheel, { passive: false }]);
  }
  for (const [type, fn, opts] of listeners) {
    element.addEventListener(type, fn, opts);
  }

  return {
    get: () => ({ ...view }),
    set(next) {
      return emit(
        {
          x: next.x ?? view.x,
          y: next.y ?? view.y,
          k: clamp(next.k ?? view.k, min, max),
        },
        'set'
      );
    },
    reset: () => emit({ ...initial }, 'reset'),
    zoomBy: (factor, pivot) => zoomBy(factor, pivot),
    panBy: (dx, dy) => panBy(dx, dy),
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      for (const [type, fn, opts] of listeners) {
        element.removeEventListener(type, fn, opts);
      }
      pointers.clear();
    },
  };
}
