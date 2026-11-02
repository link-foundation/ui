/**
 * `randomize(schema, values, { random, locked })`: a random look.
 */

import { coerce } from './coerce.js';
import { fieldType } from './types.js';
import { merge } from './values.js';

/** @typedef {import('./schema.js').SettingsSchema} SettingsSchema */
/** @typedef {import('./values.js').SettingsValues} SettingsValues */

/**
 * Randomise every field except comfort fields, locked keys and types that are
 * not randomised (`text`, custom types without `random`). `random` is
 * required (a function returning numbers in `[0, 1)`), so the same seeded
 * generator always gives the same look.
 * @param {SettingsSchema} schema
 * @param {SettingsValues|undefined} values
 * @param {{ random: () => number, locked?: Iterable<string> }} options
 * @returns {SettingsValues}
 */
export function randomize(schema, values, options) {
  const random = options?.random;
  if (typeof random !== 'function') {
    throw new TypeError('randomize needs a random() function');
  }
  const locked = new Set(options.locked ?? []);
  const out = merge(schema, values, undefined).values;
  for (const field of schema.fields.values()) {
    if (field.comfort || locked.has(field.key)) {
      continue;
    }
    const drawn = fieldType(field.type)?.random(field, random);
    if (drawn === undefined) {
      continue;
    }
    const result = coerce(field, drawn);
    if (result.ok) {
      out[field.key] = result.value;
    }
  }
  return out;
}
