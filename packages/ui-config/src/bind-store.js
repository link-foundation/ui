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
 * The subtree of a store element as an insertable node and its IDs in
 * pre-order, so it can be inserted again with the same IDs.
 * @param {import('@link-foundation/ui-store').Store} store
 * @param {string} id
 */
function subtree(store, id) {
  const ids = [];
  const build = (each) => {
    ids.push(each);
    const view = store.get(each);
    return {
      id: view.name,
      kind: view.kind,
      positional: copyValues(view.positional),
      properties: view.properties.map((p) => ({
        name: p.name,
        values: copyValues(p.values),
      })),
      unknown: copyValues(view.unknown),
      children: store.children(each).map(build),
    };
  };
  return { node: build(id), ids };
}

/**
 * Replace the positional values of an element. ui-store has no operation
 * for positional values, so the element is removed and inserted again at
 * the same place with the same IDs, inside the same transaction.
 * TODO(link-foundation/ui#101): use a store `setPositional` operation.
 */
function setPositional(store, id, values) {
  const { node, ids } = subtree(store, id);
  node.positional = copyValues(values);
  const parentId = store.parentOf(id);
  const index = store.indexOf(id);
  store.remove(id);
  store.apply({ op: 'insert', parentId, index, node, ids });
}

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
    setPositional(store, t.id, want ?? []);
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
