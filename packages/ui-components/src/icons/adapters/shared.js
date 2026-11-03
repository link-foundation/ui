/**
 * What the icon set adapters share: loading a file of an optional peer
 * package, and turning an adapter (a name map, a loader and a record
 * factory) into an icon source for registerIconSet().
 */

import { MIRROR_IN_RTL } from '../names.js';
import { splitSvg } from '../svg.js';

/**
 * @typedef {import('../icon-registry.js').AssetRecord} AssetRecord
 * @typedef {import('../icon-registry.js').IconData} IconData
 *
 * @typedef {object} IconAdapter
 * @property {string} set  the set name (`lucide`)
 * @property {string} packageName  the npm package with the icon data
 * @property {string} title  a human name (`Lucide`)
 * @property {Readonly<Record<string, string>>} names  logical name →
 *   name in the library
 * @property {(name: string) => Promise<string>} loadSvg  the SVG document
 *   of a library icon, read from the package
 * @property {(name: string) => AssetRecord} record  the asset record of a
 *   library icon
 * @property {string[]} licenseFiles  files of the package to ship with the
 *   icons (`LICENSE`)
 * @property {Record<string, string>} [notices]  generated texts to ship
 *   with the icons (file name → text)
 * @property {Record<string, string>} [defaults]  presentation attributes
 *   the library leaves to the SVG defaults
 *
 * @typedef {object} AdapterOptions
 * @property {(name: string) => Promise<string>} [load]  replace the
 *   loader, for example to fetch from your own copy of the package
 * @property {Record<string, string>} [names]  extra or replaced logical
 *   names
 */

/** Library icon names are plain words: nothing can climb out of the package. */
export const isIconName = (name) =>
  typeof name === 'string' && /^[a-z0-9][a-z0-9_-]*$/.test(name);

/**
 * The text of a file in an npm package, through the module resolver
 * (Node, Deno, Bun, or a browser import map).
 * @param {string} specifier  `@tabler/icons/outline/x.svg`
 * @returns {Promise<string>}
 */
export async function readPackageFile(specifier) {
  const url = import.meta.resolve(specifier);
  if (url.startsWith('file:')) {
    const { readFile } = await import('node:fs/promises');
    return readFile(new globalThis.URL(url), 'utf8');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${specifier}: HTTP ${response.status}`);
  }
  return response.text();
}

/**
 * The common fields of a third-party icon record.
 * @param {{set: string, name: string, license: string, copyright: string,
 *   source: string, notice: string, title: string}} fields
 * @returns {AssetRecord}
 */
export function thirdPartyRecord({
  set,
  name,
  license,
  copyright,
  source,
  notice,
  title,
}) {
  return Object.freeze({
    id: `${set}-${name}`,
    kind: 'icon',
    files: [],
    license,
    copyright,
    source,
    notice,
    attribution: 'required',
    attributionText: `${title} icon "${name}", © ${copyright}, ${license}`,
    modified: 'yes',
  });
}

/**
 * An icon source of an adapter. Logical names (`close`) go through the
 * name map; any other library name (`rocket`) is used as is.
 * @param {IconAdapter} adapter
 * @param {AdapterOptions} [options]
 * @returns {import('../icon-registry.js').IconSource & {set: string,
 *   adapter: IconAdapter, names: () => string[]}}
 */
export function createAdapterSource(adapter, options = {}) {
  const load = options.load ?? adapter.loadSvg;
  const names = { ...adapter.names, ...options.names };
  /** @type {Map<string, Promise<{viewBox: string, body: string}|undefined>>} */
  const cache = new Map();
  /** @type {Map<string, AssetRecord>} */
  const used = new Map();
  const libraryName = (name) =>
    Object.hasOwn(names, name) ? names[name] : name;
  const loadIcon = (name) => {
    if (!cache.has(name)) {
      cache.set(
        name,
        Promise.resolve()
          .then(() => load(name))
          .then((text) => splitSvg(text, { defaults: adapter.defaults }))
          .catch(() => undefined)
      );
    }
    return cache.get(name);
  };
  return Object.freeze({
    set: adapter.set,
    adapter,
    async resolve(name) {
      const library = libraryName(name);
      if (!isIconName(library)) {
        return undefined;
      }
      const data = await loadIcon(library);
      if (data === undefined) {
        return undefined;
      }
      const record = adapter.record(library);
      used.set(record.id, record);
      return { ...data, mirrorInRtl: MIRROR_IN_RTL.has(name), record };
    },
    records() {
      const mapped = Object.values(names).map((name) => adapter.record(name));
      const all = new Map(mapped.map((record) => [record.id, record]));
      used.forEach((record, id) => all.set(id, record));
      return [...all.values()];
    },
    names: () => Object.keys(names),
  });
}
