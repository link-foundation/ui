/**
 * Field types: the built-in `range`, `number`, `toggle`, `choice`, `color`
 * and `text`, and `defineFieldType` for the types an app adds (`vector3`,
 * `map`, `asset`, …).
 *
 * A type is `{ coerce, equals, random, format, css }`:
 * - `coerce(field, raw) → { ok, value }` checks a raw value: a Links
 *   Notation atom (`'24'`), a list of atoms (`['0', '0', '1']`, from
 *   `(default 0 0 1)`) or a JSON value (`24`, `true`);
 * - `equals(a, b)` compares two coerced values;
 * - `random(field, random) → value | undefined` draws a value with the
 *   injected `random()` (`undefined`: the type is not randomised);
 * - `format(field, value) → string | string[]` writes a value as Links
 *   Notation atoms (`(key atom…)`);
 * - `css(field, value) → string` is the value of a CSS variable.
 */

/** @typedef {import('./schema.js').SettingField} SettingField */

/**
 * @typedef {{
 *   coerce: (field: SettingField, raw: unknown) => { ok: boolean, value?: unknown },
 *   equals: (a: unknown, b: unknown) => boolean,
 *   random: (field: SettingField, random: () => number) => unknown,
 *   format: (field: SettingField, value: unknown) => string|string[],
 *   css: (field: SettingField, value: unknown) => string,
 * }} FieldType
 */

const fail = Object.freeze({ ok: false });
const ok = (value) => ({ ok: true, value });

/**
 * A number from a JSON number or a decimal atom (`'24'`, `'-0.5'`), or
 * `NaN`.
 * @param {unknown} raw
 */
export function toNumber(raw) {
  if (typeof raw === 'number') {
    return raw;
  }
  if (typeof raw !== 'string' || raw.trim() === '') {
    return NaN;
  }
  const text = raw.trim();
  // `Number` also reads `0x1F`, `0b11` and `Infinity`; only plain decimal
  // numbers are settings values.
  return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)
    ? Number(text)
    : NaN;
}

const decimals = (n) => {
  const text = String(n);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
};

const clamp = (n, min, max) => {
  let out = n;
  if (Number.isFinite(min)) {
    out = Math.max(min, out);
  }
  if (Number.isFinite(max)) {
    out = Math.min(max, out);
  }
  return out;
};

/** Clamp to `[min, max]` and round to the `step` grid that starts at `min`. */
function snap(field, n) {
  let out = clamp(n, field.min, field.max);
  const { step } = field;
  if (Number.isFinite(step) && step > 0) {
    const base = Number.isFinite(field.min) ? field.min : 0;
    const places = Math.max(decimals(step), decimals(base));
    out = Number(
      (base + Math.round((out - base) / step) * step).toFixed(places)
    );
    out = clamp(out, field.min, field.max);
  }
  return Object.is(out, -0) ? 0 : out;
}

function coerceNumber(field, raw) {
  const n = toNumber(raw);
  return Number.isFinite(n) ? ok(snap(field, n)) : fail;
}

function randomNumber(field, random) {
  const { min, max } = field;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined;
  }
  const step = Number.isFinite(field.step) && field.step > 0 ? field.step : 0;
  if (step === 0) {
    return snap(field, min + random() * (max - min));
  }
  const steps = Math.round((max - min) / step);
  return snap(field, min + Math.round(random() * steps) * step);
}

const numberCss = (field, value) => `${value}${field.unit ?? ''}`;
const text = (field, value) => String(value);
const same = (a, b) => Object.is(a, b);

const pick = (items, random) =>
  items[Math.floor(random() * items.length) % items.length];

const HEX = '0123456789abcdef';

/** `#rrggbb` (either case). */
export function isHexColor(value) {
  if (typeof value !== 'string' || value.length !== 7 || value[0] !== '#') {
    return false;
  }
  return [...value.slice(1).toLowerCase()].every((c) => HEX.includes(c));
}

/** @type {Record<string, FieldType>} */
const BUILT_IN = {
  range: {
    coerce: coerceNumber,
    equals: same,
    random: randomNumber,
    format: (field, value) => String(value),
    css: numberCss,
  },
  number: {
    coerce: coerceNumber,
    equals: same,
    random: randomNumber,
    format: (field, value) => String(value),
    css: numberCss,
  },
  toggle: {
    coerce(field, raw) {
      if (raw === true || raw === 'true') {
        return ok(true);
      }
      return raw === false || raw === 'false' ? ok(false) : fail;
    },
    equals: same,
    random: (field, random) => random() < 0.5,
    format: text,
    css: text,
  },
  choice: {
    coerce(field, raw) {
      const value =
        typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : raw;
      return typeof value === 'string' && (field.options ?? []).includes(value)
        ? ok(value)
        : fail;
    },
    equals: same,
    random: (field, random) =>
      field.options?.length ? pick(field.options, random) : undefined,
    format: text,
    css: text,
  },
  color: {
    coerce: (field, raw) => (isHexColor(raw) ? ok(raw) : fail),
    equals: (a, b) =>
      typeof a === 'string' &&
      typeof b === 'string' &&
      a.toLowerCase() === b.toLowerCase(),
    random: (field, random) =>
      `#${Array.from({ length: 6 }, () => pick([...HEX], random)).join('')}`,
    format: text,
    css: text,
  },
  text: {
    coerce(field, raw) {
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return ok(String(raw));
      }
      return typeof raw === 'string' ? ok(raw) : fail;
    },
    equals: same,
    random: () => undefined,
    format: text,
    css: text,
  },
};

/** The names of the built-in field types. */
export const BUILT_IN_TYPES = Object.freeze(Object.keys(BUILT_IN));

/** @type {Map<string, Readonly<FieldType>>} */
const registry = new Map(
  Object.entries(BUILT_IN).map(([name, type]) => [name, Object.freeze(type)])
);

const formatAny = (field, value) => {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const equalsAny = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Add a field type. `coerce` is required; `equals` defaults to structural
 * equality, `random` to "not randomised", `format` to the value as atoms and
 * `css` to the formatted atoms joined with spaces. The built-in types cannot
 * be replaced.
 * @param {string} name
 * @param {Partial<FieldType> & Pick<FieldType, 'coerce'>} definition
 * @returns {Readonly<FieldType>}
 */
export function defineFieldType(name, definition) {
  if (typeof name !== 'string' || name === '') {
    throw new TypeError('A field type needs a name');
  }
  if (BUILT_IN_TYPES.includes(name)) {
    throw new TypeError(
      `The built-in field type "${name}" cannot be redefined`
    );
  }
  if (typeof definition?.coerce !== 'function') {
    throw new TypeError(`The field type "${name}" needs a coerce function`);
  }
  const format = definition.format ?? formatAny;
  const type = Object.freeze({
    coerce: definition.coerce,
    equals: definition.equals ?? equalsAny,
    random: definition.random ?? (() => undefined),
    format,
    css:
      definition.css ??
      ((field, value) => [format(field, value)].flat().join(' ')),
  });
  registry.set(name, type);
  return type;
}

/**
 * The field type of a name, or `undefined`.
 * @param {string} name
 * @returns {Readonly<FieldType>|undefined}
 */
export const fieldType = (name) => registry.get(name);

/** The names of every known field type, built-in first. */
export const fieldTypes = () => [...registry.keys()];
