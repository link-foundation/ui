/**
 * The configuration layers, lowest first (docs/ARCHITECTURE.md):
 *
 * defaults < theme < site < user < session
 *
 * Each layer holds overrides in a `Map` keyed by {@link overrideKey}.
 */

/** @typedef {'defaults'|'theme'|'site'|'user'|'session'} Layer */

/** @type {readonly Layer[]} */
export const LAYERS = Object.freeze([
  'defaults',
  'theme',
  'site',
  'user',
  'session',
]);

/** The layers `set`, `unset` and `importPatch` may change. */
export const EDITABLE_LAYERS = Object.freeze(['user', 'session']);

/** The props whose first value is a key (`token color.primary`). */
export const DEFAULT_KEYED_PROPS = Object.freeze(['token', 'state']);

/** The layer the values written in the base document belong to. */
export const DOCUMENT_LAYER = 'site';

/** The separator of the parts of an override key (NUL, `^@`). */
export const KEY_SEPARATOR = '\u0000';

/**
 * The key of an override in a layer map.
 * @param {string} id
 * @param {string} name
 * @param {string|null} [key]
 */
export const overrideKey = (id, name, key) =>
  id + KEY_SEPARATOR + name + KEY_SEPARATOR + (key ?? '');

/**
 * Whether `layer` is one of {@link LAYERS}.
 * @param {unknown} layer
 * @returns {layer is Layer}
 */
export const isLayer = (layer) =>
  typeof layer === 'string' && LAYERS.includes(/** @type {Layer} */ (layer));

/**
 * The position of a layer in {@link LAYERS}.
 * @param {Layer} layer
 */
export const layerIndex = (layer) => LAYERS.indexOf(layer);
