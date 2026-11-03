/**
 * `bindStore`: keep a ui-store store in step with the resolved configuration.
 * Every change of the configuration is applied to the store as one
 * transaction with the origin `config`.
 */

import { overrideKey } from './layers.js';
import { copyValues, findProperty, valueIn, valuesEqual } from './values.js';

/** The origin of the store transactions of `bindStore`. */
export const CONFIG_ORIGIN = 'config';

/**
 * Make the store element hold the resolved value of one target.
 * @param {ReturnType<typeof import('./config.js').createConfig>} config
 * @param {import('@link-foundation/ui-store').Store} store
 * @param {{ id: string, name: string, key: string|null, mode: string }} t
 */
function applyTarget(config, store, t) {
  const view = store.get(t.id);
  if (!view) {
    return;
  }
  const want = config.resolve(t.id, t.name, t.key ?? undefined)?.value;
  const have = valueIn(view, /** @type {any} */ (t));
  if (want === undefined ? have === undefined : valuesEqual(have, want)) {
    return;
  }
  if (t.mode === 'positional') {
    store.setPositional(t.id, copyValues(want ?? []));
    return;
  }
  const at = findProperty(view.properties, t.name, t.key);
  if (t.mode === 'keyed') {
    if (at >= 0) {
      store.apply({ op: 'removeProp', id: t.id, name: t.name, index: at });
    }
    if (want !== undefined) {
      const index = at >= 0 ? at : view.properties.length;
      const values = [t.key, ...copyValues(want)];
      store.apply({ op: 'setProp', id: t.id, name: t.name, values, index });
    }
  } else if (want === undefined) {
    store.removeProp(t.id, t.name);
  } else {
    store.setProp(t.id, t.name, copyValues(want));
  }
}

/**
 * Apply the resolved configuration to a store now and after every change.
 * @param {ReturnType<typeof import('./config.js').createConfig>} config
 * @param {import('@link-foundation/ui-store').Store} store
 * @param {{ origin?: string, label?: string|null }} [options]
 * @returns {() => void}  stops following the configuration
 */
export function bindStore(config, store, options = {}) {
  const { origin = CONFIG_ORIGIN, label = 'Apply configuration' } = options;
  const sync = (targets) => {
    const unique = new Map();
    for (const t of targets) {
      unique.set(overrideKey(t.id, t.name, t.key), t);
    }
    if (unique.size === 0) {
      return;
    }
    store.transaction(
      label,
      () => {
        for (const t of unique.values()) {
          applyTarget(config, store, t);
        }
      },
      { origin }
    );
  };
  sync(config.layers.flatMap((layer) => config.overrides(layer)));
  const unsubscribe = config.subscribe(sync);
  return () => {
    unsubscribe();
  };
}
