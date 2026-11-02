/**
 * `createConfig`: every property of a UI document resolved through the five
 * configuration layers (defaults < theme < site < user < session).
 */

import { LAYERS } from './layers.js';
import { check, ConfigError } from './errors.js';
import { isValue } from './values.js';
import { createState } from './state.js';
import {
  effectiveDocument,
  exportPatch,
  importPatch,
  loadLayer,
} from './patches.js';
import { bindStore } from './bind-store.js';

/** @typedef {import('@link-foundation/ui-core').RawValue} RawValue */
/** @typedef {import('@link-foundation/ui-core').UiDocument} UiDocument */
/** @typedef {import('./layers.js').Layer} Layer */
/** @typedef {import('./state.js').ConfigEvent} ConfigEvent */

/**
 * Create the configuration of a document.
 * @param {{
 *   document: Pick<UiDocument, 'roots'> & Partial<UiDocument>,
 *   layers?: Partial<Record<Layer, string>>,
 *   keyedProps?: readonly string[],
 *   base?: string|null,
 *   maxPatchSize?: number,
 *   maxPatchOps?: number,
 *   onListenerError?: (error: unknown, events: readonly ConfigEvent[]) => void,
 * }} options
 */
export function createConfig(options) {
  const state = createState(options);
  const { checkLayer, checkEditable, targetOrError, target, batch, write } =
    state;
  const config = {
    /** The id of the document patches are written for (`(base …)`). */
    base: state.baseId,
    layers: LAYERS,
    keyedProps: Object.freeze([...state.keyedProps]),

    resolve(id, name, key) {
      const t = targetOrError(id, name, key);
      return t instanceof ConfigError ? undefined : state.entries(t).at(-1);
    },

    explain(id, name, key) {
      const t = targetOrError(id, name, key);
      return t instanceof ConfigError ? [] : state.entries(t);
    },

    /** The value of one layer only (the document counts as `site`). */
    valueIn(layer, id, name, key) {
      checkLayer(layer);
      const t = targetOrError(id, name, key);
      return t instanceof ConfigError ? undefined : state.layerValue(layer, t);
    },

    set(layer, id, name, values, key) {
      checkEditable(layer);
      const t = target(id, name, key);
      check(
        Array.isArray(values) && values.length > 0 && values.every(isValue),
        'bad-value',
        'set needs a non-empty array of Links Notation values'
      );
      batch(() => write(layer, t, values));
    },

    unset(layer, id, name, key) {
      checkEditable(layer);
      const t = target(id, name, key);
      batch(() => write(layer, t, undefined));
    },

    clear(layer) {
      checkLayer(layer);
      batch(() => {
        for (const o of [...state.maps.get(layer).values()]) {
          write(layer, o, undefined);
        }
      });
    },

    loadLayer: (layer, text) => loadLayer(state, layer, text),
    importPatch: (text, layer) => importPatch(state, text, layer),
    exportPatch: (exportOptions) => exportPatch(state, exportOptions),
    effective: () => effectiveDocument(state),

    /** Every override of a layer, in the order they were written. */
    overrides(layer) {
      checkLayer(layer);
      return [...state.maps.get(layer).values()];
    },

    subscribe: state.subscribe,
    bindStore: (store, bindOptions) => bindStore(config, store, bindOptions),
  };
  loadInitialLayers(config, options.layers);
  return Object.freeze(config);
}

/** Load the patches given to `createConfig`, lowest layer first. */
function loadInitialLayers(config, layers = {}) {
  for (const layer of Object.keys(layers)) {
    check(LAYERS.includes(layer), 'unknown-layer', `Unknown layer "${layer}"`);
  }
  for (const layer of LAYERS) {
    if (typeof layers[layer] !== 'string') {
      continue;
    }
    const { ok, diagnostics } = config.loadLayer(layer, layers[layer]);
    if (!ok) {
      const error = new ConfigError(
        'bad-patch',
        `The ${layer} layer is not a valid patch: ${diagnostics
          .filter((d) => d.severity === 'error')
          .map((d) => d.message)
          .join('; ')}`
      );
      error.diagnostics = diagnostics;
      throw error;
    }
  }
}
