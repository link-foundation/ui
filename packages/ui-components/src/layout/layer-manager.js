/**
 * The layer manager: one place that decides the stacking order (`z-index`)
 * of every floating surface. Layers have a fixed order, so raising a
 * surface only moves it within its own layer: a raised `window` can never
 * be drawn above a `modal` (deepcase-app issue 290).
 *
 * Deterministic: the order within a layer comes from a counter of `raise`
 * calls, never from a clock.
 */

/** The layers, lowest first. */
export const LAYERS = Object.freeze([
  'base',
  'dock',
  'window',
  'popover',
  'modal',
  'toast',
]);

const RANK = new Map(LAYERS.map((layer, i) => [layer, i]));

/**
 * @typedef {'base'|'dock'|'window'|'popover'|'modal'|'toast'} Layer
 *
 * @typedef {object} LayerManager
 * @property {(id: string, layer: Layer) => void} register  add a surface
 *   (or move it to another layer) on top of its layer
 * @property {(id: string) => void} raise  put a surface on top of its layer
 * @property {(id: string) => number} zIndexOf  the z-index of a surface;
 *   `NaN` when it is not registered
 * @property {(id: string) => Layer|undefined} layerOf
 * @property {(id: string) => void} unregister
 * @property {(listener: () => void) => () => void} subscribe  called after
 *   every change; returns the unsubscribe function
 * @property {() => string[]} order  the surfaces, lowest first
 */

/**
 * @param {{ base?: number, step?: number }} [options]  `base` is the
 *   z-index of the lowest surface (default 1), `step` the distance between
 *   two surfaces (default 1)
 * @returns {LayerManager}
 */
export function createLayerManager(options = {}) {
  const base = options.base ?? 1;
  const step = options.step ?? 1;
  if (!Number.isFinite(base) || !Number.isFinite(step) || step <= 0) {
    throw new RangeError(
      'createLayerManager: base must be a number and step a positive number'
    );
  }
  /** @type {Map<string, {layer: Layer, raised: number}>} */
  const surfaces = new Map();
  const listeners = new Set();
  let counter = 0;
  /** @type {Map<string, number>|null} */
  let indexes = null;

  const compare = ([, a], [, b]) =>
    RANK.get(a.layer) - RANK.get(b.layer) || a.raised - b.raised;

  function computeIndexes() {
    indexes ??= new Map(
      [...surfaces].sort(compare).map(([id], rank) => [id, base + rank * step])
    );
    return indexes;
  }

  function changed() {
    indexes = null;
    for (const listener of [...listeners]) {
      listener();
    }
  }

  return {
    register(id, layer) {
      if (!RANK.has(layer)) {
        throw new RangeError(
          `createLayerManager: unknown layer "${layer}" (expected ${LAYERS.join(', ')})`
        );
      }
      counter += 1;
      surfaces.set(id, { layer, raised: counter });
      changed();
    },
    raise(id) {
      const surface = surfaces.get(id);
      if (surface === undefined) {
        return;
      }
      const top = Math.max(
        ...[...surfaces.values()]
          .filter((s) => s.layer === surface.layer)
          .map((s) => s.raised)
      );
      if (surface.raised === top) {
        return;
      }
      counter += 1;
      surface.raised = counter;
      changed();
    },
    zIndexOf: (id) => computeIndexes().get(id) ?? Number.NaN,
    layerOf: (id) => surfaces.get(id)?.layer,
    unregister(id) {
      if (surfaces.delete(id)) {
        changed();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    order: () => [...computeIndexes().keys()],
  };
}
