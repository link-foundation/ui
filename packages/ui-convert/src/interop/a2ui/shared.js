/**
 * What the A2UI modules share: the pinned protocol version, the mapping
 * table, message reading and the encoding of dynamic values.
 */

import { decodeAny } from '../extra.js';
import { loadMapping } from '../mapping.js';
import { isObject } from '../safety.js';

/** The format name used in `(source ...)`, `(extra ...)` and diagnostics. */
export const FORMAT = 'a2ui';

/**
 * The A2UI protocol version the converter follows (the 0.9.1 production
 * specification, https://a2ui.org/specification/v0.9-a2ui/).
 */
export const A2UI_VERSION = '0.9.1';

/** The `version` values of messages the converter accepts. */
export const SUPPORTED_VERSIONS = ['v0.9', 'v0.9.1'];

/** The `version` written on messages whose input had none. */
export const DEFAULT_MESSAGE_VERSION = `v${A2UI_VERSION}`;

/** The server to client message types, in the order of the specification. */
export const MESSAGE_TYPES = [
  'createSurface',
  'updateComponents',
  'updateDataModel',
  'deleteSurface',
];

/** The mapping table (mapping.lino). */
export const mapping = loadMapping(import.meta.url);

/**
 * The keys of each component type that name other components. A layout
 * holds `children` (a list of ids or a `{ componentId, path }` template),
 * a Card or a Button one `child`, a Modal a `trigger` and a `content`, and
 * Tabs a `child` per tab.
 */
export const SLOT_KEYS = {
  Row: ['children'],
  Column: ['children'],
  List: ['children'],
  Card: ['child'],
  Button: ['child'],
  Modal: ['trigger', 'content'],
  Tabs: ['tabs'],
};

/** The A2UI types whose `value` is the bound value of an input. */
export const INPUT_TYPES = [
  'TextField',
  'CheckBox',
  'ChoicePicker',
  'Slider',
  'DateTimeInput',
];

/**
 * Whether a value is a data binding: `{ path }` and nothing else.
 * @param {unknown} value
 * @returns {value is { path: string }}
 */
export const isBinding = (value) =>
  isObject(value) &&
  typeof value.path === 'string' &&
  Object.keys(value).length === 1;

/**
 * Encode a dynamic value: a binding becomes the `(bind <path>)` link, any
 * other value the encoding of the mapping table (`null` when it cannot be
 * written, see `Mapping.encode`).
 * @param {string} name The LiNo property.
 * @param {unknown} value
 * @returns {string|string[]|null}
 */
export const encodeDynamic = (name, value) =>
  isBinding(value) ? ['bind', value.path] : mapping.encode(name, value);

/**
 * Whether a LiNo value is a `(bind <path>)` link.
 * @param {unknown} raw
 * @returns {raw is [string, string]}
 */
export const isBindLink = (raw) =>
  Array.isArray(raw) &&
  raw.length === 2 &&
  raw[0] === 'bind' &&
  typeof raw[1] === 'string';

/**
 * Decode a value written by {@link encodeDynamic}.
 * @param {string} name The LiNo property.
 * @param {import('@link-foundation/ui-core').RawValue} raw
 */
export const decodeDynamic = (name, raw) =>
  isBindLink(raw) ? { path: raw[1] } : mapping.decode(name, raw);

/** Decode one `any` atom, or `undefined` for a missing value. */
export const decodeOptional = (raw) =>
  raw === undefined ? undefined : decodeAny(raw);

/**
 * The messages of an input: an array of messages, a sample file
 * (`{ messages: [...] }`), one message, or JSON Lines text.
 * @param {unknown} input
 * @returns {unknown[]|null} `null` when the input is none of these.
 */
export function readMessages(input) {
  if (typeof input === 'string') {
    return input
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line));
  }
  if (Array.isArray(input)) {
    return input;
  }
  if (isObject(input) && Array.isArray(input.messages)) {
    return input.messages;
  }
  if (isObject(input) && MESSAGE_TYPES.some((type) => type in input)) {
    return [input];
  }
  return null;
}
