/**
 * The names of links: link-cli's names sidecar (`<db>.names.links`), as a
 * two-way map. A name is any text that does not read as something else in a
 * query: not empty, not a number, not `*` and not a `$variable`.
 */

import { isAddress, LinksError } from './links.js';

/** Whether `name` can be a name. */
export function isName(name) {
  return (
    typeof name === 'string' &&
    name !== '' &&
    name !== '*' &&
    !name.startsWith('$') &&
    !/^[0-9]+$/.test(name)
  );
}

/**
 * An empty names store.
 * @param {Iterable<[number, string]>} [entries]  `[id, name]` pairs
 */
export function createNames(entries = []) {
  const nameOf = new Map();
  const idOf = new Map();
  const names = {
    /** Give `id` the `name`; a link has one name and a name one link. */
    setName(id, name) {
      if (!isAddress(id)) {
        throw new LinksError('bad-reference', `Not a link address: ${id}`);
      }
      if (!isName(name)) {
        throw new LinksError(
          'bad-request',
          `Not a name: ${JSON.stringify(name)}`
        );
      }
      const other = idOf.get(name);
      if (other !== undefined && other !== id) {
        nameOf.delete(other);
      }
      names.removeName(id);
      nameOf.set(id, name);
      idOf.set(name, id);
      return id;
    },
    /** @returns {string | null} */
    getName: (id) => nameOf.get(id) ?? null,
    /** @returns {number | null} */
    getByName: (name) => idOf.get(name) ?? null,
    /** @returns {boolean} whether `id` had a name */
    removeName(id) {
      const name = nameOf.get(id);
      if (name === undefined) {
        return false;
      }
      nameOf.delete(id);
      idOf.delete(name);
      return true;
    },
    /** `[id, name]` pairs by address. */
    entries: () => [...nameOf.entries()].sort((a, b) => a[0] - b[0]),
  };
  for (const [id, name] of entries) {
    names.setName(id, name);
  }
  return names;
}
