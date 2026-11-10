/**
 * `coerce(field, raw)`: check one raw value against its field.
 */

import { fieldType } from './types.js';

/** @typedef {import('./schema.js').SettingField} SettingField */

function isInherited(field, raw, policy) {
  return (
    (field?.props?.nullable === 'true' || field?.props?.inherit === 'true') &&
    (raw === null || (policy.primitives !== 'strict' && raw === 'null'))
  );
}

function validPrimitive(field, raw, policy) {
  if (policy.primitives !== 'strict') {
    return true;
  }
  const expected = {
    number: 'number',
    range: 'number',
    toggle: 'boolean',
    choice: 'string',
    color: 'string',
    text: 'string',
  }[field?.type];
  return !expected || typeof raw === expected;
}

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
export function coerce(field, raw, policy = field?.normalization ?? {}) {
  if (isInherited(field, raw, policy)) {
    return { ok: true, value: null };
  }
  if (!validPrimitive(field, raw, policy)) {
    return { ok: false };
  }
  const type = fieldType(field?.type);
  if (!type || raw === undefined || raw === null) {
    return { ok: false };
  }
  try {
    const result = type.coerce(
      policy.numbers === 'clamp' ? { ...field, step: undefined } : field,
      raw
    );
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
  if (a === null || b === null) {
    return Object.is(a, b);
  }
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
  const out =
    value === null ? 'null' : type ? type.format(field, value) : String(value);
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
