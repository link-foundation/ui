/**
 * The patch side of a configuration: loading and importing `overrides`
 * patches, exporting the editable layers, and the effective document.
 */

import {
  DOCUMENT_LAYER,
  EDITABLE_LAYERS,
  layerIndex,
  overrideKey,
} from './layers.js';
import { ConfigError, diagnostic, hasError } from './errors.js';
import { readPatch, writePatch } from './patch.js';
import { copyValues, findProperty, valuesEqual } from './values.js';
import { elementsById } from './state.js';

/** @typedef {ReturnType<typeof import('./state.js').createState>} State */

/** Warnings for a patch written for another document or layer. */
function mismatches(state, patch, layer) {
  const out = [];
  if (patch.base && state.baseId && patch.base !== state.baseId) {
    out.push(
      diagnostic(
        'base-mismatch',
        'warning',
        `The patch is for "${patch.base}", the document is "${state.baseId}"`
      )
    );
  }
  if (layer && patch.layer && patch.layer !== layer) {
    out.push(
      diagnostic(
        'layer-mismatch',
        'warning',
        `The patch is for the ${patch.layer} layer; it is applied to ${layer}`
      )
    );
  }
  return out;
}

/**
 * Read a patch and check its ops against the document; with an error
 * diagnostic nothing is applied.
 * @param {State} state
 * @param {string} text
 * @param {string|undefined} layer
 */
export function preparePatch(state, text, layer) {
  const patch = readPatch(text, {
    keyedProps: state.keyedProps,
    maxSize: state.maxPatchSize,
    maxOps: state.maxPatchOps,
  });
  const diagnostics = [
    ...patch.diagnostics,
    ...mismatches(state, patch, layer),
  ];
  const ops = [];
  patch.ops.forEach((op, index) => {
    const values = op.op === 'set' ? op.values : undefined;
    // A keyed name that is also the element's kind is positional: the key
    // read from the patch is its first value.
    const node = state.byId.get(op.id);
    const positional = node && node.kind === op.name && op.key !== null;
    const t = state.targetOrError(op.id, op.name, positional ? null : op.key);
    if (t instanceof ConfigError) {
      diagnostics.push(
        diagnostic(t.code, 'error', t.message, { op: index, element: op.id })
      );
      return;
    }
    ops.push({
      t,
      values: positional && values ? [op.key, ...values] : values,
    });
  });
  return { patch, ops, diagnostics, ok: !hasError(diagnostics) };
}

/**
 * Replace a layer with a patch; with an error nothing changes.
 * @param {State} state
 * @param {import('./layers.js').Layer} layer
 * @param {string} text
 */
export function loadLayer(state, layer, text) {
  state.checkLayer(layer);
  const { ops, diagnostics, ok } = preparePatch(state, text, layer);
  if (!ok) {
    return { ok, diagnostics };
  }
  const next = new Map();
  for (const { t, values } of ops) {
    const k = overrideKey(t.id, t.name, t.key);
    if (values === undefined) {
      next.delete(k);
    } else {
      next.set(k, { t, values });
    }
  }
  state.batch(() => {
    for (const [k, o] of [...state.maps.get(layer)]) {
      if (!next.has(k)) {
        state.write(layer, o, undefined);
      }
    }
    for (const { t, values } of next.values()) {
      state.write(layer, t, values);
    }
  });
  return { ok, diagnostics };
}

/**
 * Apply the ops of a patch on top of an editable layer.
 * @param {State} state
 * @param {string} text
 * @param {'user'|'session'} [layer]  default: the layer named by the patch
 */
export function importPatch(state, text, layer) {
  if (layer !== undefined) {
    state.checkEditable(layer);
  }
  const { patch, ops, diagnostics, ok } = preparePatch(state, text, layer);
  const into = layer ?? patch.layer;
  if (!into) {
    diagnostics.push(
      diagnostic('missing-layer', 'error', 'The patch names no layer')
    );
  } else if (!EDITABLE_LAYERS.includes(into)) {
    diagnostics.push(
      diagnostic(
        'read-only-layer',
        'error',
        `The ${into} layer is loaded, never edited; import into user or session`
      )
    );
  }
  if (!ok || hasError(diagnostics)) {
    return { ok: false, diagnostics };
  }
  state.batch(() => {
    for (const { t, values } of ops) {
      state.write(into, t, values);
    }
  });
  return { ok: true, diagnostics };
}

/**
 * The overrides of `layers` that differ from the value resolved up to and
 * including `against`, as an `overrides` patch.
 * @param {State} state
 * @param {{ layers?: readonly import('./layers.js').Layer[],
 *   against?: import('./layers.js').Layer, layer?: import('./layers.js').Layer,
 *   name?: string, base?: string|null }} [options]
 */
export function exportPatch(state, options = {}) {
  const { layers = EDITABLE_LAYERS, against = DOCUMENT_LAYER } = options;
  layers.forEach(state.checkLayer);
  state.checkLayer(against);
  const sorted = [...layers].sort((a, b) => layerIndex(a) - layerIndex(b));
  const layer = options.layer ?? sorted[0] ?? 'user';
  const ops = [];
  const seen = new Set();
  for (const from of sorted) {
    for (const [k, t] of state.maps.get(from)) {
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      const top = sorted
        .map((l) => state.maps.get(l).get(k)?.values)
        .filter(Boolean)
        .at(-1);
      const below = state.entries(t, layerIndex(against)).at(-1)?.value;
      if (below === undefined || !valuesEqual(top, below)) {
        const { id, name, key } = t;
        ops.push({ op: 'set', id, name, key, values: copyValues(top) });
      }
    }
  }
  return writePatch({
    name: options.name ?? `${layer}-overrides`,
    layer,
    base: options.base ?? state.baseId,
    ops,
  });
}

/** Write a resolved value into a (mutable) node. */
function applyValue(node, t, values) {
  if (t.mode === 'positional') {
    node.positional = values;
    return;
  }
  const full = t.mode === 'keyed' ? [t.key, ...values] : values;
  const at = findProperty(node.properties, t.name, t.key);
  if (at >= 0) {
    node.properties[at] = { name: t.name, values: full };
  } else {
    node.properties.push({ name: t.name, values: full });
  }
}

/** A deep copy of a node. */
const clone = (node) => ({
  id: node.id,
  kind: node.kind,
  positional: copyValues(node.positional),
  properties: node.properties.map((p) => ({
    name: p.name,
    values: copyValues(p.values),
  })),
  children: node.children.map(clone),
  unknown: copyValues(node.unknown),
});

/**
 * The base document with all layers applied.
 * @param {State} state
 * @returns {import('@link-foundation/ui-core').UiDocument}
 */
export function effectiveDocument(state) {
  const { document } = state;
  const roots = document.roots.map(clone);
  const byId = elementsById({ roots });
  const seen = new Set();
  for (const map of state.maps.values()) {
    for (const [k, t] of map) {
      if (seen.has(k) || !byId.has(t.id)) {
        continue;
      }
      seen.add(k);
      applyValue(byId.get(t.id), t, copyValues(state.entries(t).at(-1).value));
    }
  }
  return {
    spec: document.spec,
    roots,
    unknown: copyValues(document.unknown ?? []),
    byId,
    diagnostics: [],
  };
}
