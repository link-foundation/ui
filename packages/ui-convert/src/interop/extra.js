/**
 * Values that cross the format boundary.
 *
 * Every LiNo atom is a string, so the JSON type of a value is kept by the
 * encoding itself: a JSON string is written as the bare atom unless that
 * text would read back as other JSON (`true`, `12`, `"x"`, `{...}`), in
 * which case it is written as JSON text. Every other JSON value is written
 * as its JSON text. Decoding reverses this exactly, so no value changes type
 * on a round trip.
 *
 * Properties a mapping does not know are kept, not dropped, as
 * `(extra <format> '<json object>')`.
 */

/**
 * Whether a text is JSON.
 * @param {string} text
 */
function parsesAsJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Encode a JSON value as one LiNo atom.
 * @param {unknown} value
 * @returns {string}
 */
export function encodeAny(value) {
  if (typeof value === 'string' && !parsesAsJson(value)) {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * Decode a LiNo value written by {@link encodeAny}. A link (an array) is
 * decoded value by value.
 * @param {import('@link-foundation/ui-core').RawValue} raw
 * @returns {unknown}
 */
export function decodeAny(raw) {
  if (Array.isArray(raw)) {
    return raw.map(decodeAny);
  }
  if (typeof raw !== 'string') {
    return raw.values.map(decodeAny);
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Split an object into the keys a mapping handles and the rest.
 * @param {Record<string, unknown>} object
 * @param {Iterable<string>} known
 * @returns {[Record<string, unknown>, Record<string, unknown>]}
 */
export function splitKnown(object, known) {
  const names = new Set(known);
  const handled = {};
  const rest = {};
  for (const [key, value] of Object.entries(object)) {
    (names.has(key) ? handled : rest)[key] = value;
  }
  return [handled, rest];
}

/**
 * The `(extra <format> '<json>')` property for the unknown keys of an
 * object, or `null` when there are none.
 * @param {string} format
 * @param {Record<string, unknown>} rest
 */
export function extraProperty(format, rest) {
  return Object.keys(rest).length === 0
    ? null
    : { name: 'extra', values: [format, JSON.stringify(rest)] };
}

/**
 * The unknown keys kept by {@link extraProperty} for one format.
 * @param {{ properties: { name: string, values: unknown[] }[] }} node
 * @param {string} format
 * @returns {Record<string, unknown>}
 */
export function readExtra(node, format) {
  const out = {};
  for (const { name, values } of node.properties) {
    if (name === 'extra' && values[0] === format) {
      Object.assign(out, JSON.parse(String(values[1])));
    }
  }
  return out;
}
