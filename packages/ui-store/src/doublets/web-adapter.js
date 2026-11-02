/**
 * Copy doublets from `encodeDocument` into a `doublets-web` `UnitedLinks`
 * instance (https://github.com/linksplatform/doublets-web, Unlicense).
 *
 * `doublets-web` is an optional peer dependency: this module never imports
 * it statically. `openDoubletsWeb()` loads it with a dynamic `import()` only
 * when it is called.
 *
 * The API used (README of the `master` branch and `doublets_web.d.ts` of
 * 0.1.3): `new UnitedLinks(new LinksConstants())`, `links.create()` returns
 * the index of a new empty link, `links.update(index, source, target)` sets
 * its parts and `links.count()` counts the links.
 */

/**
 * @typedef {object} UnitedLinksLike
 * @property {() => number} create
 * @property {(index: number, source: number, target: number) => number} update
 */

/**
 * Create every triple of `encoded.links` in `unitedLinks`, in index order.
 * A point `(i, i, i)` stays a point. Returns the index map: the index of
 * each triple → the index of its link in `unitedLinks` (the same numbers
 * when `unitedLinks` was empty).
 * @param {{ links: Iterable<{ index: number, source: number, target: number }> }} encoded
 * @param {UnitedLinksLike} unitedLinks
 * @returns {Map<number, number>}
 */
export function copyToDoubletsWeb(encoded, unitedLinks) {
  const map = new Map();
  const ordered = [...encoded.links].sort((a, b) => a.index - b.index);
  for (const { index, source, target } of ordered) {
    const created = unitedLinks.create();
    map.set(index, created);
    const to = (part) => {
      if (part === index) {
        return created;
      }
      if (!map.has(part)) {
        throw new RangeError(`Link ${index} refers to later link ${part}`);
      }
      return map.get(part);
    };
    unitedLinks.update(created, to(source), to(target));
  }
  return map;
}

/**
 * Load `doublets-web` (dynamic `import()`) and create an empty
 * `UnitedLinks` store. Rejects when the package is not installed or cannot
 * be loaded in this environment (it is a WebAssembly module built for
 * bundlers).
 * @param {() => Promise<any>} [load]  default: `() => import('doublets-web')`
 * @returns {Promise<{ module: any, links: any }>}
 */
export async function openDoubletsWeb(load = () => import('doublets-web')) {
  const module = await load();
  const links = new module.UnitedLinks(new module.LinksConstants());
  return { module, links };
}
