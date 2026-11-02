/**
 * Settings values: a plain object `{ key: value }` with a value for every
 * field of the schema. Documents and share links store only the values that
 * differ from the defaults (`diff`).
 */

import { coerce, equalValue } from './coerce.js';
import { UNSAFE_KEYS } from './read.js';

/** @typedef {import('./schema.js').SettingsSchema} SettingsSchema */
/** @typedef {Record<string, unknown>} SettingsValues */

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The default value of every field.
 * @param {SettingsSchema} schema
 * @returns {SettingsValues}
 */
export function defaults(schema) {
  const out = {};
  for (const field of schema.fields.values()) {
    out[field.key] = field.default;
  }
  return out;
}

/** Read own enumerable keys without running getters that throw. */
function entriesOf(untrusted) {
  try {
    return Object.keys(untrusted).map((key) => [key, untrusted[key]]);
  } catch {
    return [];
  }
}

/**
 * Merge untrusted values (parsed from storage, a link or a document) onto
 * `base`. Unknown keys and values that do not coerce are left out and listed
 * in `rejected`; every other value is coerced (clamped, rounded, …). Never
 * throws.
 * @param {SettingsSchema} schema
 * @param {SettingsValues|undefined} base the values to start from (default:
 *   the defaults); missing keys take their default
 * @param {unknown} untrusted
 * @returns {{ values: SettingsValues, rejected: string[] }}
 */
export function merge(schema, base, untrusted) {
  const values = defaults(schema);
  if (isPlainObject(base)) {
    for (const [key, raw] of entriesOf(base)) {
      const field = schema.fields.get(key);
      const result = field ? coerce(field, raw) : { ok: false };
      if (result.ok) {
        values[key] = result.value;
      }
    }
  }
  const rejected = [];
  if (!isPlainObject(untrusted)) {
    return { values, rejected };
  }
  for (const [key, raw] of entriesOf(untrusted)) {
    const field = UNSAFE_KEYS.includes(key)
      ? undefined
      : schema.fields.get(key);
    const result = field ? coerce(field, raw) : { ok: false };
    if (result.ok) {
      values[key] = result.value;
    } else {
      rejected.push(key);
    }
  }
  return { values, rejected };
}

/**
 * Whether a value is the default of its field (an unknown key: `false`).
 * @param {SettingsSchema} schema
 * @param {string} key
 * @param {unknown} value
 */
export function isDefault(schema, key, value) {
  const field = schema.fields.get(key);
  return field ? equalValue(field, value, field.default) : false;
}

/**
 * Only the values that differ from their defaults, in schema order.
 * @param {SettingsSchema} schema
 * @param {SettingsValues} values
 * @returns {SettingsValues}
 */
export function diff(schema, values) {
  const out = {};
  for (const field of schema.fields.values()) {
    const { key } = field;
    if (
      Object.hasOwn(values ?? {}, key) &&
      !equalValue(field, values[key], field.default)
    ) {
      out[key] = values[key];
    }
  }
  return out;
}

/**
 * The values with some keys (default: all of them) back to their defaults.
 * @param {SettingsSchema} schema
 * @param {SettingsValues} values
 * @param {Iterable<string>} [keys]
 * @returns {SettingsValues}
 */
export function reset(schema, values, keys) {
  const out = merge(schema, values, undefined).values;
  const list = keys === undefined ? schema.fields.keys() : keys;
  for (const key of list) {
    const field = schema.fields.get(key);
    if (field) {
      out[key] = field.default;
    }
  }
  return out;
}

/**
 * How many values differ from their defaults.
 * @param {SettingsSchema} schema
 * @param {SettingsValues} values
 */
export const countCustomized = (schema, values) =>
  Object.keys(diff(schema, values)).length;

/**
 * Whether two sets of values are equal field by field (a missing key is its
 * default; the order of keys does not matter).
 * @param {SettingsSchema} schema
 * @param {SettingsValues} a
 * @param {SettingsValues} b
 * @param {{ skip?: (field: import('./schema.js').SettingField) => boolean }} [options]
 */
export function equalValues(schema, a, b, { skip } = {}) {
  for (const field of schema.fields.values()) {
    if (skip?.(field)) {
      continue;
    }
    const left = Object.hasOwn(a ?? {}, field.key)
      ? a[field.key]
      : field.default;
    const right = Object.hasOwn(b ?? {}, field.key)
      ? b[field.key]
      : field.default;
    if (!equalValue(field, left, right)) {
      return false;
    }
  }
  return true;
}
