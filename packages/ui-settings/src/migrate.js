/**
 * `migrate(schema, stored)`: bring stored values of an older schema version
 * up to date.
 *
 * Every migration from the stored version on runs in order:
 * 1. `(rename old new)` moves a value to its new key;
 * 2. `(old-default key value)` drops a value equal to the old default, so a
 *    viewer who never changed it gets the new default;
 * then the values are merged (coerced, unknown keys rejected).
 *
 * That is the policy for the viewer's own stored values: a value they never
 * changed follows the new default. A look somebody shared (`{ look: true }`)
 * keeps showing what was shared instead: a key it does not set takes the old
 * default.
 */

import { coerce, equalValue } from './coerce.js';
import { diagnostic, UNSAFE_KEYS } from './read.js';
import { merge } from './values.js';

/** @typedef {import('./schema.js').SettingsSchema} SettingsSchema */
/** @typedef {import('./values.js').SettingsValues} SettingsValues */
/** @typedef {import('./read.js').Diagnostic} Diagnostic */

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function copyOf(untrusted) {
  const out = {};
  if (!isPlainObject(untrusted)) {
    return out;
  }
  try {
    for (const key of Object.keys(untrusted)) {
      if (!UNSAFE_KEYS.includes(key)) {
        out[key] = untrusted[key];
      }
    }
  } catch {
    // An object with a throwing getter: keep what was read.
  }
  return out;
}

/** Whether a stored value equals an old default (read with the new field). */
function equalsOldDefault(schema, key, value, raw) {
  const field = schema.fields.get(key);
  if (!field) {
    return String(value) === String(raw);
  }
  const a = coerce(field, value);
  const b = coerce(field, raw, {
    ...field.normalization,
    primitives: 'coerce',
  });
  return a.ok && b.ok && equalValue(field, a.value, b.value);
}

function runMigration(schema, migration, values, look) {
  for (const { from, to } of migration.renames) {
    if (Object.hasOwn(values, from)) {
      if (!Object.hasOwn(values, to) && !UNSAFE_KEYS.includes(to)) {
        values[to] = values[from];
      }
      delete values[from];
    }
  }
  for (const { key, raw } of migration.oldDefaults) {
    if (look) {
      // A look written against the old defaults: an unset key showed the
      // old default, and still does.
      if (!Object.hasOwn(values, key) && !UNSAFE_KEYS.includes(key)) {
        const field = schema.fields.get(key);
        const parsed =
          field &&
          coerce(field, raw, {
            ...field.normalization,
            primitives: 'coerce',
          });
        values[key] = parsed?.ok ? parsed.value : raw;
      }
    } else if (
      Object.hasOwn(values, key) &&
      equalsOldDefault(schema, key, values[key], raw)
    ) {
      delete values[key];
    }
  }
}

/**
 * Migrate stored values (`{ version, values }`; a missing version is the
 * schema's version) to the schema's version. Never throws.
 * @param {SettingsSchema} schema
 * @param {{ version?: number, values?: unknown }} stored
 * @param {{ base?: SettingsValues, look?: boolean }} [options] `base`: the
 *   values the result is merged onto (default: the defaults); `look`: the
 *   values are a shared look, not the viewer's own
 * @returns {{ values: SettingsValues, rejected: string[], version: number,
 *   diagnostics: Diagnostic[] }}
 */
export function migrate(schema, stored, { base, look = false } = {}) {
  const diagnostics = [];
  const values = copyOf(stored?.values);
  let version = Number.isInteger(stored?.version)
    ? stored.version
    : schema.version;
  if (version > schema.version) {
    diagnostics.push(
      diagnostic(
        'newer-version',
        'warning',
        `The values are version ${version}; the schema is version ${schema.version}`,
        { version }
      )
    );
  }
  while (version < schema.version) {
    const migration = schema.migrations.find((m) => m.from === version);
    if (!migration) {
      diagnostics.push(
        diagnostic(
          'no-migration',
          'warning',
          `No migration from version ${version}; the values are read as version ${schema.version}`,
          { version }
        )
      );
      break;
    }
    runMigration(schema, migration, values, look);
    version = migration.to;
  }
  const merged = merge(schema, base, values);
  return { ...merged, version: schema.version, diagnostics };
}
