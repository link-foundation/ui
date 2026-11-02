/**
 * The state of a configuration: the overrides of every layer, how a
 * property name is read for an element, and change events.
 */

import { walk } from '@link-foundation/ui-core';
import {
  DEFAULT_KEYED_PROPS,
  DOCUMENT_LAYER,
  EDITABLE_LAYERS,
  isLayer,
  LAYERS,
  overrideKey,
} from './layers.js';
import { check, ConfigError } from './errors.js';
import { DEFAULT_MAX_PATCH_OPS, DEFAULT_MAX_PATCH_SIZE } from './patch.js';
import { freezeValues, valueIn, valuesEqual } from './values.js';

/** @typedef {import('@link-foundation/ui-core').RawValue} RawValue */
/** @typedef {import('@link-foundation/ui-core').UiDocument} UiDocument */
/** @typedef {import('@link-foundation/ui-core').UiNode} UiNode */
/** @typedef {import('@link-foundation/ui-core').Diagnostic} Diagnostic */
/** @typedef {import('./layers.js').Layer} Layer */

/**
 * What a property name means for an element: its positional values (the
 * name is the element's kind), one key of a keyed prop, or a plain prop.
 * @typedef {{ id: string, name: string, key: string|null, mode: 'positional'|'keyed'|'prop' }} Target
 */

/**
 * @typedef {{ layer: Layer, id: string, name: string, key: string|null,
 *   mode: Target['mode'], before: readonly RawValue[]|null,
 *   after: readonly RawValue[]|null }} ConfigEvent
 */

/** Every element of a document by id (the first one for a repeated id). */
export function elementsById(document) {
  if (document.byId instanceof Map) {
    return document.byId;
  }
  const byId = new Map();
  walk(/** @type {UiDocument} */ (document), (node) => {
    if (node.id !== null && !byId.has(node.id)) {
      byId.set(node.id, node);
    }
  });
  return byId;
}

/**
 * The state behind `createConfig`.
 * @param {Parameters<typeof import('./config.js').createConfig>[0]} options
 */
export function createState(options) {
  const {
    document,
    keyedProps = DEFAULT_KEYED_PROPS,
    maxPatchSize = DEFAULT_MAX_PATCH_SIZE,
    maxPatchOps = DEFAULT_MAX_PATCH_OPS,
    onListenerError = (error) => console.error(error),
  } = options ?? {};
  check(
    document && Array.isArray(document.roots),
    'bad-document',
    'createConfig needs a UI document ({ roots, … })'
  );
  const byId = elementsById(document);
  const baseId = options.base ?? document.roots[0]?.id ?? null;
  /** @type {Map<Layer, Map<string, Target & { values: readonly RawValue[] }>>} */
  const maps = new Map(LAYERS.map((layer) => [layer, new Map()]));
  const listeners = new Set();
  /** @type {ConfigEvent[]|null} */
  let pending = null;

  const checkLayer = (layer) =>
    check(isLayer(layer), 'unknown-layer', `Unknown layer "${layer}"`);
  const checkEditable = (layer) => {
    checkLayer(layer);
    check(
      EDITABLE_LAYERS.includes(layer),
      'read-only-layer',
      `The ${layer} layer is loaded, never edited; use user or session`
    );
  };

  /**
   * What `(id, name, key)` means, or a ConfigError.
   * @returns {Target|ConfigError}
   */
  function targetOrError(id, name, key) {
    const node = typeof id === 'string' ? byId.get(id) : undefined;
    if (!node) {
      return new ConfigError(
        'unknown-id',
        `The document has no element "${id}"`
      );
    }
    if (typeof name !== 'string' || name === '') {
      return new ConfigError('bad-value', 'The property name must be text');
    }
    if (name === node.kind) {
      return { id, name, key: null, mode: 'positional' };
    }
    if (keyedProps.includes(name)) {
      return typeof key === 'string' && key !== ''
        ? { id, name, key, mode: 'keyed' }
        : new ConfigError('missing-key', `"${name}" of "${id}" needs a key`);
    }
    return { id, name, key: null, mode: 'prop' };
  }

  function target(id, name, key) {
    const t = targetOrError(id, name, key);
    if (t instanceof ConfigError) {
      throw t;
    }
    return t;
  }

  /** The values of a target in one layer, the document counted as site. */
  function layerValue(layer, t) {
    const found = maps.get(layer).get(overrideKey(t.id, t.name, t.key));
    if (found) {
      return found.values;
    }
    return layer === DOCUMENT_LAYER ? valueIn(byId.get(t.id), t) : undefined;
  }

  /** Every layer up to `top` that has a value, lowest first. */
  function entries(t, top = LAYERS.length - 1) {
    const out = [];
    for (const layer of LAYERS.slice(0, top + 1)) {
      const value = layerValue(layer, t);
      if (value !== undefined) {
        out.push(Object.freeze({ layer, value }));
      }
    }
    return out;
  }

  function emit(events) {
    for (const listener of [...listeners]) {
      try {
        listener(events);
      } catch (error) {
        onListenerError(error, events);
      }
    }
  }

  /** Run `fn` and emit every change it made as one listener call. */
  function batch(fn) {
    if (pending) {
      return fn();
    }
    pending = [];
    try {
      return fn();
    } finally {
      const events = Object.freeze(pending);
      pending = null;
      if (events.length > 0) {
        emit(events);
      }
    }
  }

  /** Put (or, with `undefined`, remove) one override of a layer. */
  function write(layer, t, values) {
    const map = maps.get(layer);
    const k = overrideKey(t.id, t.name, t.key);
    const before = map.get(k)?.values ?? null;
    if (values === undefined) {
      if (before === null) {
        return;
      }
      map.delete(k);
    } else {
      if (before !== null && valuesEqual(before, values)) {
        return;
      }
      map.set(k, Object.freeze({ ...t, values: freezeValues(values) }));
    }
    const after = map.get(k)?.values ?? null;
    pending.push(
      Object.freeze({
        layer,
        id: t.id,
        name: t.name,
        key: t.key,
        mode: t.mode,
        before,
        after,
      })
    );
  }

  return {
    document,
    byId,
    baseId,
    maps,
    keyedProps,
    maxPatchSize,
    maxPatchOps,
    checkLayer,
    checkEditable,
    targetOrError,
    target,
    layerValue,
    entries,
    batch,
    write,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
