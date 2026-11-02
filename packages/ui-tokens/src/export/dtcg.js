/**
 * `toDtcg(resolved, { keepAliases })`: the tokens as a Design Tokens Format
 * Module 2025.10 file (https://www.designtokens.org/tr/2025.10/format/),
 * the nested JSON object of a `.tokens.json` file.
 *
 * - Every token has `$type` (section 5.2.2: tools "MUST NOT attempt to
 *   guess the type"), `$value` and, when written, `$description`.
 * - Aliases stay aliases, `"{color.primary}"` (section 7.1.1), unless
 *   `keepAliases` is `false`; aliases inside composites stay too.
 * - A token whose path is also a group (`a` and `a.b`) is the group's
 *   `$root` token (section 6.2), referenced as `"{a.$root}"`.
 * - The tokens a mode changes go to the root
 *   `$extensions["com.github.link-foundation.ui"].modes[mode]`, a token
 *   group of the same shape: DTCG 2025.10 has no modes, and extensions are
 *   the place for "vendor-specific data" (section 5.2.3).
 */

import { values as coreValues } from '@link-foundation/ui-core';
import { COMPOSITE_FIELDS } from '../values.js';

const { toHex } = coreValues;

/**
 * @typedef {import('../types.js').ResolvedTokens} ResolvedTokens
 * @typedef {import('../types.js').ResolvedToken} ResolvedToken
 * @typedef {import('../types.js').TokenValue} TokenValue
 */

/** The `$extensions` key of this package (reverse domain name notation). */
export const DTCG_EXTENSION = 'com.github.link-foundation.ui';

/** `x` with at most 4 decimals when that is still the same hex byte. */
const component = (x) => {
  const short = Math.round(x * 10000) / 10000;
  return Math.round(short * 255) === Math.round(x * 255) &&
    Math.abs(x * 255 - Math.round(x * 255)) < 1e-9
    ? short
    : x;
};

/**
 * A colour as a DTCG Color Module 2025.10 object. Section 4.1 "Format":
 *
 * > "colorSpace: A string that specifies the color space or color model
 * > ... components: An array representing the color components. The number
 * > of components depends on the color space. ... alpha (optional): A
 * > number that represents the alpha value of the color. This value is
 * > between 0 and 1, where 0 is fully transparent and 1 is fully opaque. If
 * > omitted, the alpha value of the color MUST be assumed to be 1 (fully
 * > opaque). hex (optional): A string that represents a fallback value of
 * > the color. The fallback color MUST be formatted in 6 digit CSS hex
 * > color notation format to avoid conflicts with the provided alpha
 * > value."
 *
 * (https://www.designtokens.org/tr/2025.10/color/#format). sRGB components
 * are 0..1; an sRGB channel that is an exact hex byte is written with 4
 * decimals (`0x67 / 255` is `0.4039`), which reads back as the same byte.
 * @param {TokenValue} color
 */
function colorObject(color) {
  const hex = toHex({ ...color, a: 1 }).toLowerCase();
  if (color.space === 'oklch') {
    return {
      colorSpace: 'oklch',
      components: [color.l, color.c, color.h],
      alpha: color.a,
      hex,
    };
  }
  return {
    colorSpace: 'srgb',
    components: [color.r, color.g, color.b].map(component),
    alpha: component(color.a),
    hex,
  };
}

/** `"{a.b}"`, or `"{a.b.$root}"` when `a.b` is also a group. */
const reference = (path, groups) =>
  `{${groups.has(path) ? `${path}.$root` : path}}`;

/**
 * A token value as a DTCG `$value`.
 * @param {TokenValue} value
 * @param {Set<string>} groups
 */
function dtcgValue(value, groups) {
  switch (value.type) {
    case 'token-ref':
      return reference(value.path, groups);
    case 'color':
      return colorObject(value);
    case 'dimension':
    case 'duration':
      return { value: value.value, unit: value.unit };
    case 'fontFamily':
      return Array.isArray(value.value) ? [...value.value] : value.value;
    case 'number':
    case 'fontWeight':
      return value.value;
    case 'cubicBezier':
      return [...value.value];
    case 'shadow':
      return Array.isArray(value.value)
        ? value.value.map((layer) => shadowLayer(layer, groups))
        : shadowLayer(value.value, groups);
    case 'typography':
      return fields('typography', value.value, groups);
    default:
      throw new TypeError(`No DTCG value for the type ${value.type}`);
  }
}

function fields(kind, object, groups) {
  return Object.fromEntries(
    COMPOSITE_FIELDS[kind].map(([, key]) => [
      key,
      dtcgValue(object[key], groups),
    ])
  );
}

function shadowLayer(layer, groups) {
  if (layer.type === 'token-ref') {
    return reference(layer.path, groups);
  }
  const out = fields('shadow', layer, groups);
  if (layer.inset !== undefined) {
    out.inset = layer.inset;
  }
  return out;
}

/** Every path that has tokens under it: `a` for `a.b`. */
function groupPaths(maps) {
  const groups = new Set();
  for (const map of maps) {
    for (const path of map.keys()) {
      const parts = path.split('.');
      for (let i = 1; i < parts.length; i += 1) {
        groups.add(parts.slice(0, i).join('.'));
      }
    }
  }
  return groups;
}

/**
 * Set an own property: a token path is input, and `parent[name] = value`
 * with the name `__proto__` would replace the prototype (or, through
 * `constructor`, reach `Object`); `JSON.parse` reads such a name back as an
 * own property too.
 */
const own = (object, name, value) =>
  Object.defineProperty(object, name, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });

/**
 * The nested group of some tokens.
 * @param {Map<string, ResolvedToken>} tokens
 */
function group(tokens, groups, keepAliases) {
  const root = {};
  for (const token of tokens.values()) {
    const node = {
      $type: token.type,
      $value: dtcgValue(keepAliases ? token.raw : token.value, groups),
    };
    if (token.description !== undefined) {
      node.$description = token.description;
    }
    const parts = token.path.split('.');
    if (groups.has(token.path)) {
      parts.push('$root');
    }
    let parent = root;
    for (const part of parts.slice(0, -1)) {
      if (!Object.hasOwn(parent, part)) {
        own(parent, part, {});
      }
      parent = parent[part];
    }
    own(parent, parts.at(-1), node);
  }
  return root;
}

/**
 * The tokens as a DTCG 2025.10 token file.
 * @param {ResolvedTokens} resolved
 * @param {{ keepAliases?: boolean }} [options]  `keepAliases` (default
 *   `true`) writes aliases as references; `false` writes resolved values
 * @returns {Record<string, any>} the JSON object; `JSON.stringify` it
 */
export function toDtcg(resolved, { keepAliases = true } = {}) {
  const modes = [...(resolved.modes ?? [])].filter(([, t]) => t.size > 0);
  const groups = groupPaths([resolved, ...modes.map(([, t]) => t)]);
  const out = group(resolved, groups, keepAliases);
  if (modes.length > 0) {
    out.$extensions = {
      [DTCG_EXTENSION]: {
        modes: Object.fromEntries(
          modes.map(([mode, tokens]) => [
            mode,
            group(tokens, groups, keepAliases),
          ])
        ),
      },
    };
  }
  return out;
}
