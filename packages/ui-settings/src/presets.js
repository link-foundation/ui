/**
 * Presets and shared looks. Comfort fields (`(comfort)`: reduced motion,
 * sound, volume, …) are the viewer's own: a preset or a look shared by
 * someone else never changes them.
 */

import { defaults, equalValues, merge } from './values.js';

/** @typedef {import('./schema.js').SettingsSchema} SettingsSchema */
/** @typedef {import('./values.js').SettingsValues} SettingsValues */

/**
 * Apply a look (somebody else's values) to the viewer's values: every
 * non-comfort field takes the look's value (its default when the look does
 * not set it); comfort fields keep the viewer's value.
 * @param {SettingsSchema} schema
 * @param {SettingsValues|undefined} viewer
 * @param {SettingsValues} look
 * @returns {SettingsValues}
 */
export function applySharedLook(schema, viewer, look) {
  const mine = merge(schema, viewer, undefined).values;
  const theirs = merge(schema, undefined, look).values;
  const out = {};
  for (const field of schema.fields.values()) {
    out[field.key] = field.comfort ? mine[field.key] : theirs[field.key];
  }
  return out;
}

/**
 * The values of a preset: the defaults plus the preset's values, with the
 * viewer's comfort fields kept.
 * @param {SettingsSchema} schema
 * @param {SettingsValues|undefined} values
 * @param {string} id
 * @returns {SettingsValues}
 */
export function applyPreset(schema, values, id) {
  const preset = schema.presets.get(id);
  if (!preset) {
    throw new RangeError(`Unknown preset "${id}"`);
  }
  return applySharedLook(schema, values, {
    ...(preset.partial
      ? merge(schema, values, undefined).values
      : defaults(schema)),
    ...preset.values,
  });
}

/**
 * The id of the preset the values match (comfort fields aside; the order of
 * keys does not matter), or `null`.
 * @param {SettingsSchema} schema
 * @param {SettingsValues} values
 * @returns {string|null}
 */
export function activePreset(schema, values) {
  for (const preset of schema.presets.values()) {
    const expected = { ...defaults(schema), ...preset.values };
    if (
      equalValues(schema, values, expected, {
        skip: (f) =>
          f.comfort || (preset.partial && !Object.hasOwn(preset.values, f.key)),
      })
    ) {
      return preset.id;
    }
  }
  return null;
}
