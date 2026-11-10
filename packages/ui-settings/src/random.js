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
    const bounds = randomBounds(field);
    const drawn = fieldType(field.type)?.random(bounds ?? field, random);
    if (drawn === undefined) {
      continue;
    }
    const result = coerce(field, drawn);
    if (
      result.ok &&
      (!bounds || (result.value >= bounds.min && result.value <= bounds.max))
    ) {
      out[field.key] = result.value;
    }
  }
  return out;
}

/** Preserve the original step origin; never coerce an out-of-bounds draw into a heavier value. */
function randomBounds(field) {
  const option = field.random ?? field.props?.random;
  if (!option || !['number', 'range'].includes(field.type)) {
    return null;
  }
  let min = Math.max(field.min ?? 0, option.min ?? -Infinity);
  let max = Math.min(
    field.max ?? 100,
    option === 'not-heavier-than-default'
      ? field.default
      : (option.max ?? Infinity)
  );
  if (field.step > 0 && field.normalization?.numbers !== 'clamp') {
    const base = field.min ?? 0;
    min = base + Math.ceil((min - base) / field.step) * field.step;
    max = base + Math.floor((max - base) / field.step) * field.step;
  }
  return { ...field, min, max };
}
