/**
 * Persistence of the editable layers in Web Storage: `user` in
 * `localStorage`, `session` in `sessionStorage`. The stored text is the
 * diff-only `overrides` patch of the layer.
 */

import { diagnostic } from './errors.js';
import { EDITABLE_LAYERS, LAYERS, layerIndex } from './layers.js';

/** The default storage keys of the editable layers. */
export const STORAGE_KEYS = Object.freeze({
  user: 'link-ui.config.user.v1',
  session: 'link-ui.config.session.v1',
});

/**
 * Restore `layer` from `storage` and write it back on every change.
 * Storage errors and invalid stored text never throw: they become
 * diagnostics (and `onDiagnostic` calls), and invalid text is ignored.
 * @param {ReturnType<typeof import('./config.js').createConfig>} config
 * @param {'user'|'session'} layer
 * @param {Pick<Storage, 'getItem'|'setItem'|'removeItem'>|undefined} storage
 * @param {string} [key]
 * @param {{ sync?: boolean, eventTarget?: Window, onDiagnostic?: (d: import('@link-foundation/ui-core').Diagnostic) => void }} [options]
 * @returns {{ diagnostics: import('@link-foundation/ui-core').Diagnostic[], stop: () => void }}
 */
export function persistLayer(config, layer, storage, key, options = {}) {
  if (!EDITABLE_LAYERS.includes(layer)) {
    throw new TypeError(`Only ${EDITABLE_LAYERS.join(' and ')} can be stored`);
  }
  const storageKey = key ?? STORAGE_KEYS[layer];
  const diagnostics = [];
  const report = (d) => {
    diagnostics.push(d);
    options.onDiagnostic?.(d);
  };
  const failed = (action, error) =>
    report(
      diagnostic(
        'storage-error',
        'warning',
        `Could not ${action} ${storageKey}: ${error?.message ?? error}`,
        { key: storageKey }
      )
    );
  if (!storage) {
    report(
      diagnostic('no-storage', 'warning', `No storage for the ${layer} layer`)
    );
    return { diagnostics, stop: () => {} };
  }
  let stored = null;
  try {
    stored = storage.getItem(storageKey);
  } catch (error) {
    failed('read', error);
  }
  if (typeof stored === 'string' && stored.trim() !== '') {
    const result = config.loadLayer(layer, stored);
    if (!result.ok) {
      report(
        diagnostic(
          'invalid-stored-patch',
          'warning',
          `The stored ${layer} layer (${storageKey}) is not a valid patch; it is ignored`,
          { key: storageKey }
        )
      );
    }
    result.diagnostics.forEach(report);
  }
  let receiving = false;
  const against = LAYERS[layerIndex(layer) - 1];
  const save = (events) => {
    if (receiving || !events.some((e) => e.layer === layer)) {
      return;
    }
    try {
      if (config.overrides(layer).length === 0) {
        storage.removeItem(storageKey);
      } else {
        storage.setItem(
          storageKey,
          config.exportPatch({ layers: [layer], against })
        );
      }
    } catch (error) {
      failed('write', error);
    }
  };
  const stop = config.subscribe(save);
  const events = options.eventTarget ?? globalThis.window;
  const receive = (event) => {
    if (
      (event.key !== storageKey && event.key !== null) ||
      (event.storageArea && event.storageArea !== storage)
    ) {
      return;
    }
    receiving = true;
    try {
      if (event.newValue === null) {
        config.clear(layer);
      } else {
        const result = config.loadLayer(layer, event.newValue);
        result.diagnostics.forEach(report);
      }
    } finally {
      receiving = false;
    }
  };
  if (options.sync) {
    events?.addEventListener('storage', receive);
  }
  return {
    diagnostics,
    stop() {
      stop();
      if (options.sync) {
        events?.removeEventListener('storage', receive);
      }
    },
  };
}

/** Keep the `user` layer in `localStorage` (or the given storage). */
export const persistUserLayer = (config, storage, key, options) =>
  persistLayer(
    config,
    'user',
    storage === undefined ? globalThis.localStorage : storage,
    key,
    options
  );

/** Keep the `session` layer in `sessionStorage` (or the given storage). */
export const persistSessionLayer = (config, storage, key, options) =>
  persistLayer(
    config,
    'session',
    storage === undefined ? globalThis.sessionStorage : storage,
    key,
    options
  );
