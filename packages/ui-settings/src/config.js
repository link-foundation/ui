/**
 * `bindConfig(config, schema)`: settings values as overrides of one element
 * of a ui-config document (#18). Every setting is a prop of the element
 * `settings` (`(set settings liquid.blur 24)`) in the `user` layer, so the
 * dev mode, `explain`, `exportPatch` and `persistLayer` see them like any
 * other override.
 */

import { writePatch } from '@link-foundation/ui-config';

import { coerce, equalValue, formatValue } from './coerce.js';
import { rawOf } from './read.js';
import { merge } from './values.js';

/** @typedef {import('./schema.js').SettingsSchema} SettingsSchema */
/** @typedef {import('./values.js').SettingsValues} SettingsValues */

const ORDER = ['defaults', 'theme', 'site', 'user', 'session'];

/** Throw unless the config document has the element `target`. */
function checkTarget(config, target, layer) {
  const probe = writePatch({
    name: 'settings-probe',
    layer,
    ops: [{ op: 'unset', id: target, name: 'settings-probe' }],
  });
  // An unset of a prop that has no override changes nothing.
  const { ok, diagnostics } = config.importPatch(probe, layer);
  if (!ok) {
    const error = new Error(
      `bindConfig: ${diagnostics.map((d) => d.message).join('; ')}`
    );
    error.diagnostics = diagnostics;
    throw error;
  }
}

/**
 * Bind settings values to a config.
 * @param {ReturnType<typeof import('@link-foundation/ui-config').createConfig>} config
 * @param {SettingsSchema} schema
 * @param {{ target?: string, layer?: 'user'|'session' }} [options]
 *   `target`: the id of the element whose props are the settings (default
 *   `settings`); `layer`: the layer the values are written to (default
 *   `user`)
 */
export function bindConfig(
  config,
  schema,
  { target = 'settings', layer = 'user' } = {}
) {
  checkTarget(config, target, layer);
  for (const field of schema.fields.values()) {
    if (field.comfort) {
      config.registerComfort(target, field.key);
    }
  }
  const below = ORDER.slice(0, ORDER.indexOf(layer));

  /** The value of a field from the given layers (top first), or undefined. */
  const fromLayers = (field, layers) => {
    const entries = config
      .explain(target, field.key)
      .filter((entry) => layers.includes(entry.layer));
    for (const entry of entries.reverse()) {
      const result = coerce(field, rawOf(entry.value));
      if (result.ok) {
        return result.value;
      }
    }
    return undefined;
  };

  const baseline = (field) => fromLayers(field, below) ?? field.default;

  /** Every resolved value (invalid overrides fall through to the default). */
  const values = () => {
    const out = {};
    for (const field of schema.fields.values()) {
      out[field.key] = fromLayers(field, ORDER) ?? baseline(field);
    }
    return out;
  };

  /**
   * Write values (only the keys given) as one change: a value equal to the
   * layers below is unset, not written.
   * @param {SettingsValues} changes
   * @returns {{ rejected: string[] }}
   */
  const update = (changes) => {
    const { values: next, rejected } = merge(schema, values(), changes);
    const ops = [];
    for (const key of Object.keys(changes ?? {})) {
      const field = schema.fields.get(key);
      if (!field || rejected.includes(key)) {
        continue;
      }
      if (equalValue(field, next[key], baseline(field))) {
        ops.push({ op: 'unset', id: target, name: key });
      } else {
        ops.push({
          op: 'set',
          id: target,
          name: key,
          values: formatValue(field, next[key]),
        });
      }
    }
    if (ops.length > 0) {
      config.importPatch(
        writePatch({ name: 'settings-change', layer, ops }),
        layer
      );
    }
    return { rejected };
  };

  return {
    values,
    get: (key) => values()[key],
    set: (key, value) => update({ [key]: value }),
    update,
    /** Remove the overrides of some keys (default: all) in the layer. */
    reset(keys) {
      const list = keys === undefined ? [...schema.fields.keys()] : [...keys];
      const ops = list
        .filter((key) => schema.fields.has(key))
        .map((key) => ({ op: 'unset', id: target, name: key }));
      if (ops.length > 0) {
        config.importPatch(
          writePatch({ name: 'settings-reset', layer, ops }),
          layer
        );
      }
    },
    /**
     * Call `listener(values)` after every change of a setting in any layer.
     * @param {(values: SettingsValues) => void} listener
     * @returns {() => void} unsubscribe
     */
    subscribe(listener) {
      return config.subscribe((events) => {
        const relevant = events.some(
          (event) => event.id === target && schema.fields.has(event.name)
        );
        if (relevant) {
          listener(values());
        }
      });
    },
  };
}
