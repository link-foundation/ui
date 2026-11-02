/**
 * The in-memory storage: a map of links with a source and a target index.
 * It reuses freed addresses, the last freed first, like doublets-web, and
 * takes any free address with `createAt`, near or far.
 */

import { ANY, BREAK, CONTINUE, NULL, constants } from './constants.js';
import {
  checkParts,
  isAddress,
  linkOf,
  LinksError,
  normalizeQuery,
  notFound,
} from './links.js';

/** Add `id` to the set of `key` in `index`. */
function addTo(index, key, id) {
  let set = index.get(key);
  if (!set) {
    set = new Set();
    index.set(key, set);
  }
  set.add(id);
}

/** Remove `id` from the set of `key` in `index`. */
function removeFrom(index, key, id) {
  const set = index.get(key);
  set.delete(id);
  if (set.size === 0) {
    index.delete(key);
  }
}

/**
 * An empty in-memory storage.
 * @returns {import('./index.js').LinksStorage}
 */
export function createMemoryLinks() {
  /** @type {Map<number, [number, number]>} */
  const links = new Map();
  const bySource = new Map();
  const byTarget = new Map();
  /** Freed addresses below `next`. */
  const free = [];
  let next = 1;

  const take = (id) => {
    links.set(id, [NULL, NULL]);
    addTo(bySource, NULL, id);
    addTo(byTarget, NULL, id);
    return id;
  };

  /** The addresses that can match `query`, smallest candidate set first. */
  const candidates = (query) => {
    if (query.id !== ANY) {
      return links.has(query.id) ? [query.id] : [];
    }
    const sets = [];
    if (query.from_id !== ANY) {
      sets.push(bySource.get(query.from_id) ?? new Set());
    }
    if (query.to_id !== ANY) {
      sets.push(byTarget.get(query.to_id) ?? new Set());
    }
    if (sets.length === 0) {
      return [...links.keys()].sort((a, b) => a - b);
    }
    sets.sort((a, b) => a.size - b.size);
    return [...sets[0]].sort((a, b) => a - b);
  };

  const each = (handler, query) => {
    const q = normalizeQuery(query);
    for (const id of candidates(q)) {
      const parts = links.get(id);
      if (
        parts === undefined ||
        (q.from_id !== ANY && parts[0] !== q.from_id) ||
        (q.to_id !== ANY && parts[1] !== q.to_id)
      ) {
        continue;
      }
      if (handler(linkOf(id, parts[0], parts[1])) === BREAK) {
        return BREAK;
      }
    }
    return CONTINUE;
  };

  return {
    constants,
    create() {
      while (free.length > 0) {
        const id = free.pop();
        if (!links.has(id)) {
          return take(id);
        }
      }
      while (links.has(next)) {
        next++;
      }
      return take(next++);
    },
    createAt(id) {
      if (!isAddress(id)) {
        throw new LinksError('bad-reference', `Not a link address: ${id}`);
      }
      if (links.has(id)) {
        throw new LinksError('exists', `Link ${id} exists`);
      }
      // A skipped address stays free: create() passes over taken ones, so
      // a link far away (a temporary id of a client) costs nothing.
      if (id === next) {
        next++;
      }
      return take(id);
    },
    update(id, source, target) {
      const parts = links.get(id);
      if (!parts) {
        throw notFound(id);
      }
      checkParts(source, target);
      removeFrom(bySource, parts[0], id);
      removeFrom(byTarget, parts[1], id);
      links.set(id, [source, target]);
      addTo(bySource, source, id);
      addTo(byTarget, target, id);
      return id;
    },
    delete(id) {
      const parts = links.get(id);
      if (!parts) {
        throw notFound(id);
      }
      removeFrom(bySource, parts[0], id);
      removeFrom(byTarget, parts[1], id);
      links.delete(id);
      if (id === next - 1) {
        next--;
      } else {
        free.push(id);
      }
      return id;
    },
    count(query) {
      const q = normalizeQuery(query);
      if (q.id === ANY && q.from_id === ANY && q.to_id === ANY) {
        return links.size;
      }
      let n = 0;
      each(() => {
        n++;
        return CONTINUE;
      }, q);
      return n;
    },
    each,
  };
}
