/**
 * `coerce(field, raw)`: check one raw value against its field.
 */

import { fieldType } from './types.js';

/** @typedef {import('./schema.js').SettingField} SettingField */

/**
 * Coerce a raw value (a Links Notation atom, a list of atoms or a JSON value)
 * to the value of a field: ranges are clamped and rounded to their step,
 * choices must be one of the options, colors `#rrggbb`, toggles
 * `true`/`false`. Never throws; a field of an unknown type rejects every
 * value.
 * @param {SettingField} field
 * @param {unknown} raw
 * @returns {{ ok: boolean, value?: unknown }}
 */
export function coerce(field, raw) {
  const type = fieldType(field?.type);
  if (!type || raw === undefined || raw === null) {
    return { ok: false };
  }
  try {
    const result = type.coerce(field, raw);
    return result?.ok === true
      ? { ok: true, value: result.value }
      : { ok: false };
  } catch {
    // A custom type that throws on odd input rejects it.
    return { ok: false };
  }
}

/**
 * Whether two values of a field are equal.
 * @param {SettingField} field
 * @param {unknown} a
 * @param {unknown} b
 */
export function equalValue(field, a, b) {
  const type = fieldType(field.type);
  return type ? Boolean(type.equals(a, b)) : Object.is(a, b);
}

/**
 * A value as Links Notation atoms.
 * @param {SettingField} field
 * @param {unknown} value
 * @returns {string[]}
 */
export function formatValue(field, value) {
  const type = fieldType(field.type);
  const out = type ? type.format(field, value) : String(value);
  return Array.isArray(out) ? out.map(String) : [String(out)];
}

/**
 * The value of a CSS variable for a field value.
 * @param {SettingField} field
 * @param {unknown} value
 */
export function cssValue(field, value) {
  const type = fieldType(field.type);
  return type ? String(type.css(field, value)) : String(value);
}
