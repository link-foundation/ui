/**
 * `fromDtcg(json, { id })`: a DTCG 2025.10 token file as a Links Notation
 * token set, the inverse of `toDtcg`.
 *
 * - Groups give the dotted path; `$root` tokens (section 6.2) are the
 *   group's own token; a group's `$type` is inherited (section 5.2.2).
 * - `"{a.b}"` (section 7.1.1) and `{ "$ref": "#/a/b/$value" }` (section
 *   7.1.2) become `(token a.b)`.
 * - `$extensions["com.github.link-foundation.ui"].modes` (written by
 *   `toDtcg`) become `(mode NAME ...)` links.
 * - `(type T)` is written only when the value alone would read as another
 *   type, and always on aliases, whose DTCG `$type` is checked by the
 *   resolver.
 *
 * Throws a `TypeError` naming the token for what has no Links Notation
 * form: a token without a type, a value that does not fit its type, a
 * colour space other than srgb or oklch without a `hex` fallback, a group
 * `$extends`.
 */

import { formatLinks, values as coreValues } from '@link-foundation/ui-core';
import { DTCG_EXTENSION } from '../export/dtcg.js';
import {
  COMPOSITE_FIELDS,
  TOKEN_TYPES,
  inferredType,
  tokenValueRaw,
  typeTokenValue,
} from '../values.js';

const { parseColor } = coreValues;

/** @typedef {import('../types.js').TokenValue} TokenValue */

const fail = (path, message) => {
  throw new TypeError(`DTCG token "${path}": ${message}`);
};

const isObject = (x) =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** `a.b.$root` -> `a.b`. */
const stripRoot = (path) => path.replace(/(^|\.)\$root$/u, '');

/** `#/a/b/$value` (JSON Pointer, RFC 6901) -> `a.b`. */
function pointerPath(pointer, path) {
  const parts = /^#\/(.+)\/\$value$/u.exec(pointer);
  if (parts === null) {
    fail(path, `the $ref "${pointer}" is not a "#/.../$value" pointer`);
  }
  const names = parts[1]
    .split('/')
    .map((p) => p.replaceAll('~1', '/').replaceAll('~0', '~'));
  return stripRoot(names.join('.'));
}

/** A reference (`"{a.b}"` or `{ $ref }`) as a `token-ref`, else `null`. */
function referenceOf(value, path) {
  if (typeof value === 'string') {
    const match = /^\{([^{}]+)\}$/u.exec(value);
    return match === null
      ? null
      : { type: 'token-ref', path: stripRoot(match[1]) };
  }
  if (isObject(value) && typeof value.$ref === 'string') {
    return { type: 'token-ref', path: pointerPath(value.$ref, path) };
  }
  return null;
}

/** A number of 0..1 that is a hex byte up to 4 decimals, as that byte. */
const snap = (x) => {
  const byte = Math.round(x * 255);
  return Math.abs(x - byte / 255) <= 5.1e-5 ? byte / 255 : x;
};

const componentNumber = (c) => (c === 'none' ? 0 : c);

/** A Color Module object as a colour token value. */
function colorValue(color, path) {
  if (typeof color === 'string') {
    return parseColor(color) ?? fail(path, `"${color}" is not a colour`);
  }
  if (!isObject(color) || !Array.isArray(color.components)) {
    fail(path, 'a colour is { colorSpace, components, alpha?, hex? }');
  }
  const [x, y, z] = color.components.map(componentNumber);
  const a = color.alpha ?? 1;
  switch (color.colorSpace) {
    case 'srgb':
      return {
        type: 'color',
        space: 'srgb',
        r: snap(x),
        g: snap(y),
        b: snap(z),
        a: snap(a),
      };
    case 'oklch':
      return { type: 'color', space: 'oklch', l: x, c: y, h: z, a };
    default: {
      const hex = typeof color.hex === 'string' ? parseColor(color.hex) : null;
      if (hex === null) {
        fail(
          path,
          `the colour space "${color.colorSpace}" needs a hex fallback`
        );
      }
      return { ...hex, a: snap(a) };
    }
  }
}

const quantity = (type, value) =>
  isObject(value) ? `${value.value}${value.unit}` : value;

/**
 * A DTCG `$value` as a token value of `type`, via its Links Notation form,
 * so that it is checked exactly like a value read from text.
 * @returns {TokenValue}
 */
function tokenValue(value, type, path) {
  const ref = referenceOf(value, path);
  if (ref !== null) {
    return ref;
  }
  const typed = (raw, t) =>
    typeTokenValue(raw, t) ?? fail(path, `the value is not a ${t}`);
  const field = (kind, object) => {
    if (!isObject(object)) {
      fail(path, `a ${kind} value is an object`);
    }
    return COMPOSITE_FIELDS[kind].map(([name, key, fieldType]) => {
      const v = tokenValue(object[key], fieldType, path);
      return [
        name,
        ...[tokenValueRaw(v)].flat(v.type === 'fontFamily' ? 1 : 0),
      ];
    });
  };
  const layer = (object) => {
    const r = referenceOf(object, path);
    if (r !== null) {
      return tokenValueRaw(r);
    }
    const inset = isObject(object) && object.inset !== undefined;
    return [
      'shadow',
      ...field('shadow', object),
      ...(inset ? [['inset', String(object.inset)]] : []),
    ];
  };
  switch (type) {
    case 'color':
      return colorValue(value, path);
    case 'dimension':
    case 'duration':
      return typed(quantity(type, value), type);
    case 'number':
    case 'fontWeight':
      return typed(String(value), type);
    case 'fontFamily':
      return typed(value, type);
    case 'cubicBezier':
      return typed(['cubic-bezier', ...[value].flat().map(String)], type);
    case 'shadow':
      return typed(
        Array.isArray(value) ? value.map(layer) : layer(value),
        type
      );
    case 'typography':
      return typed(['typography', ...field('typography', value)], type);
    default:
      return fail(
        path,
        `the type "${type}" is not one of ${TOKEN_TYPES.join(', ')}`
      );
  }
}

/** Every token of a group, depth first: `{ path, type, value, description }`. */
function tokensOf(group, prefix, inherited, out) {
  if (group.$extends !== undefined) {
    fail(
      prefix,
      'group $extends is not supported; write (extends ...) instead'
    );
  }
  const type = group.$type ?? inherited;
  if (Object.hasOwn(group, '$value')) {
    const path = stripRoot(prefix);
    const ref = referenceOf(group.$value, path);
    if (type === undefined && ref === null) {
      fail(
        path,
        'no $type (DTCG 2025.10 section 5.2.2: tools must not guess it)'
      );
    }
    out.push({
      path,
      type: type ?? null,
      value: ref ?? tokenValue(group.$value, type, path),
      description: group.$description,
    });
    return out;
  }
  for (const [name, child] of Object.entries(group)) {
    if ((!name.startsWith('$') || name === '$root') && isObject(child)) {
      tokensOf(child, prefix === '' ? name : `${prefix}.${name}`, type, out);
    }
  }
  return out;
}

/** One `token PATH VALUE...` link, with `type T` and `description '...'`. */
function tokenLink({ path, type, value, description }) {
  const raw = tokenValueRaw(value);
  const spread =
    Array.isArray(value.value) &&
    (value.type === 'fontFamily' || value.type === 'shadow');
  const typeLink =
    type !== null && (value.type === 'token-ref' || inferredType(raw) !== type)
      ? [['type', type]]
      : [];
  const describe =
    description === undefined ? [] : [['description', String(description)]];
  return ['token', path, ...(spread ? raw : [raw]), ...typeLink, ...describe];
}

/**
 * A DTCG 2025.10 token file as a Links Notation token set, written in the
 * nested form (#133):
 *
 * ```lino
 * material3: theme
 *   token color.primary '#6750A4'
 *   mode dark
 *     token color.primary '#D0BCFF'
 * ```
 * @param {string|Record<string, any>} json  the file text or its object
 * @param {{ id?: string }} [options]  `id` names the set (default `tokens`)
 * @returns {string}
 */
export function fromDtcg(json, { id = 'tokens' } = {}) {
  const root = typeof json === 'string' ? JSON.parse(json) : json;
  if (!isObject(root)) {
    throw new TypeError('A DTCG token file is a JSON object');
  }
  const tokens = tokensOf(root, '', undefined, []).map(tokenLink);
  const modes = Object.entries(
    root.$extensions?.[DTCG_EXTENSION]?.modes ?? {}
  ).map(([mode, group]) => [
    'mode',
    mode,
    ...tokensOf(group, '', undefined, []).map(tokenLink),
  ]);
  return formatLinks([{ id, values: ['theme', ...tokens, ...modes] }]);
}
