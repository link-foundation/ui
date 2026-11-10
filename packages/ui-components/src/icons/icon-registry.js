/**
 * The icon registry: named icon sets, each a source that resolves a name
 * to icon data and lists the asset records of what it can supply.
 *
 * The own set (`own`, CC0-1.0, assets/icons/own/) is always registered; a
 * name that a set lacks falls back to the own set and then to a
 * placeholder, so an icon never renders as nothing.
 */

import { DEFAULT_ICON_SET, MIRROR_IN_RTL } from './names.js';
import OWN_ICONS from './own-icons.js';

/**
 * @typedef {object} AssetRecord  an asset record of assets/assets.lino
 *   (scripts/lib/asset-records.mjs), as plain data
 * @property {string} id
 * @property {string} kind
 * @property {string[]} files
 * @property {string} license  an SPDX expression
 * @property {string} copyright  `none` for our own public-domain icons
 * @property {string} [source]
 * @property {string} [notice]
 * @property {'required'|'none'} [attribution]
 * @property {string} [attributionText]
 * @property {'yes'|'no'} [modified]
 *
 * @typedef {object} IconData
 * @property {string} [title]  library accessible name
 * @property {string} viewBox
 * @property {string} body  SVG markup drawn in currentColor
 * @property {boolean} mirrorInRtl  flip horizontally in right-to-left text
 * @property {AssetRecord|undefined} record  the licence record of the icon
 *
 * @typedef {object} IconSource
 * @property {(name: string) => Promise<IconData|undefined>} resolve
 * @property {() => AssetRecord[]} records
 *
 * @typedef {string | {set?: string, name: string}} IconRef  `close`,
 *   `lucide:check` or `{set: 'lucide', name: 'check'}`
 *
 * @typedef {object} StaticIconModule  a module written by
 *   scripts/build-icons.mjs (`dist/icons/<set>.js`)
 * @property {string} set
 * @property {Record<string, {viewBox: string, body: string,
 *   mirrorInRtl?: boolean, record: string}>} icons
 * @property {AssetRecord[]} records
 */

/** Our own CC0-1.0 placeholder: a dashed square with a question mark. */
export const PLACEHOLDER_ICON = Object.freeze({
  viewBox: '0 0 24 24',
  body: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/></g>',
  mirrorInRtl: false,
  record: undefined,
  placeholder: true,
});

/** @type {Map<string, IconSource>} */
const sets = new Map();
/** @type {Set<(set: string) => void>} */
const listeners = new Set();

const checkSource = (set, source) => {
  if (typeof set !== 'string' || set === '') {
    throw new TypeError('registerIconSet: the set name must be a string');
  }
  if (
    typeof source?.resolve !== 'function' ||
    typeof source?.records !== 'function'
  ) {
    throw new TypeError(
      `registerIconSet(${set}): the source needs resolve(name) and records()`
    );
  }
};

/**
 * Register (or replace) an icon set. Rendered `ui-icon` elements of the
 * set update. Each set keeps one source: registering a set again replaces
 * the earlier source.
 * @param {string} set
 * @param {IconSource} source
 * @returns {() => void} unregister the source again
 */
export function registerIconSet(set, source) {
  checkSource(set, source);
  sets.set(set, source);
  listeners.forEach((listener) => listener(set));
  return () => {
    if (sets.get(set) !== source) {
      return;
    }
    // The own set is always there: unregistering a replacement restores it.
    if (set === DEFAULT_ICON_SET) {
      sets.set(set, OWN_SOURCE);
    } else {
      sets.delete(set);
    }
    listeners.forEach((listener) => listener(set));
  };
}

/** The names of the registered sets. */
export const iconSets = () => [...sets.keys()];

/** The source registered for a set. */
export const getIconSet = (set) => sets.get(set);

/**
 * Call `listener(set)` whenever a set is registered or removed.
 * @param {(set: string) => void} listener
 * @returns {() => void} stop listening
 */
export function onIconSetsChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Split a reference into set and name (`lucide:check`, `{name, set}`).
 * @param {IconRef} ref
 * @returns {{set: string, name: string}}
 */
export function parseIconRef(ref) {
  if (typeof ref === 'string') {
    const colon = ref.indexOf(':');
    return colon === -1
      ? { set: DEFAULT_ICON_SET, name: ref }
      : { set: ref.slice(0, colon), name: ref.slice(colon + 1) };
  }
  return { set: ref?.set || DEFAULT_ICON_SET, name: String(ref?.name ?? '') };
}

async function tryResolve(set, name) {
  const source = sets.get(set);
  if (source === undefined || name === '') {
    return undefined;
  }
  try {
    return await source.resolve(name);
  } catch {
    return undefined;
  }
}

/**
 * Resolve an icon: the named set, then the own set, then the placeholder.
 * Brand marks skip the own set so a missing brand never becomes a UI glyph.
 * @param {IconRef} ref
 * @returns {Promise<IconData & {set: string, name: string,
 *   placeholder?: boolean}>}  `set` is the set that supplied the icon
 */
export async function resolveIcon(ref) {
  const { set, name } = parseIconRef(ref);
  const order =
    set === DEFAULT_ICON_SET || set === 'brand'
      ? [set]
      : [set, DEFAULT_ICON_SET];
  if (set === 'brand' && !sets.has(set)) {
    console.warn(
      `brand:${name} could not be loaded: brand set is not registered`
    );
  }
  for (const candidate of order) {
    const icon = await tryResolve(candidate, name);
    if (icon !== undefined) {
      return { ...icon, set: candidate, name };
    }
  }
  return { ...PLACEHOLDER_ICON, set: DEFAULT_ICON_SET, name };
}

/**
 * The asset records of every registered set (or of the given sets).
 * @param {string[]} [only]
 * @returns {AssetRecord[]}
 */
export function iconRecords(only) {
  return [...sets.entries()]
    .filter(([set]) => only === undefined || only.includes(set))
    .flatMap(([, source]) => source.records());
}

/**
 * A source over a module written by scripts/build-icons.mjs; the icons
 * need no network or package at run time.
 * @param {StaticIconModule} module
 * @returns {IconSource}
 */
export function createStaticSource(module) {
  const records = new Map(module.records.map((r) => [r.id, r]));
  return Object.freeze({
    resolve(name) {
      const icon = Object.hasOwn(module.icons, name)
        ? module.icons[name]
        : undefined;
      return Promise.resolve(
        icon === undefined
          ? undefined
          : {
              ...(icon.title ? { title: icon.title } : {}),
              viewBox: icon.viewBox,
              body: icon.body,
              mirrorInRtl: icon.mirrorInRtl ?? MIRROR_IN_RTL.has(name),
              record: records.get(icon.record),
            }
      );
    },
    records: () => [...records.values()],
    names: () => Object.keys(module.icons),
  });
}

const OWN_SOURCE = createStaticSource(OWN_ICONS);
registerIconSet(DEFAULT_ICON_SET, OWN_SOURCE);
