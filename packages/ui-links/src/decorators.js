/**
 * Storage decorators. Each takes a storage and returns one with the same
 * interface, so they stack in any order: `withCascade(observe(memory))`.
 */

import { CONTINUE } from './constants.js';
import { allLinks, decorate, getLink, linkOf, notFound } from './links.js';

/**
 * @typedef {{ id: number, from_id: number, to_id: number }} Link
 * @typedef {{ before: Link | null, after: Link | null }} Change
 */

/**
 * Report every write: `listener({ before, after })` after `create`
 * (`before` is `null`), `update` and `delete` (`after` is `null`).
 * @param {any} links
 * @param {(change: Change) => void} listener
 */
export function observe(links, listener) {
  const report = (before, after) => listener(Object.freeze({ before, after }));
  const methods = {
    create() {
      const id = links.create();
      report(null, getLink(links, id));
      return id;
    },
    update(id, source, target) {
      const before = getLink(links, id);
      const result = links.update(id, source, target);
      report(before, linkOf(id, source, target));
      return result;
    },
    delete(id) {
      const before = getLink(links, id);
      const result = links.delete(id);
      report(before, null);
      return result;
    },
  };
  if (typeof links.createAt === 'function') {
    methods.createAt = (id) => {
      const result = links.createAt(id);
      report(null, getLink(links, id));
      return result;
    };
  }
  return decorate(links, methods);
}

/**
 * Every link that uses `id` as its source or target, transitively, with
 * `id` itself: what a cascading delete removes. Ordered by address.
 */
export function dependentsOf(links, id) {
  const found = new Map();
  const stack = [id];
  while (stack.length > 0) {
    const at = stack.pop();
    if (found.has(at)) {
      continue;
    }
    const link = getLink(links, at);
    if (link === null) {
      continue;
    }
    found.set(at, link);
    for (const query of [{ from_id: at }, { to_id: at }]) {
      links.each((user) => {
        if (!found.has(user.id)) {
          stack.push(user.id);
        }
        return CONTINUE;
      }, query);
    }
  }
  return [...found.values()].sort((a, b) => a.id - b.id);
}

/**
 * Delete `id` and every link that uses it, transitively, so no link refers
 * to a deleted address (link-cli's rule). Returns the deleted links.
 */
export function deleteCascade(links, id) {
  const doomed = dependentsOf(links, id);
  if (doomed.length === 0) {
    throw notFound(id);
  }
  for (const link of doomed) {
    links.delete(link.id);
  }
  return doomed;
}

/** `delete` removes the links that use the deleted one too. */
export function withCascade(links) {
  return decorate(links, {
    delete(id) {
      deleteCascade(links, id);
      return id;
    },
  });
}

/**
 * The net change of each link from a list of changes, in the order the links
 * first changed: a link created and deleted is gone, a link updated twice is
 * one update. A change that is no change (`before` equal to `after`) is
 * kept: it is a read.
 * @param {Change[]} changes
 * @returns {Change[]}
 */
export function netChanges(changes) {
  const byId = new Map();
  for (const { before, after } of changes) {
    const id = (before ?? after).id;
    const known = byId.get(id);
    if (known) {
      known.after = after;
    } else {
      byId.set(id, { before, after });
    }
  }
  return [...byId.values()]
    .filter(({ before, after }) => before !== null || after !== null)
    .map((change) => Object.freeze(change));
}

/** The same link, or both `null`. */
export const sameLink = (a, b) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.id === b.id &&
    a.from_id === b.from_id &&
    a.to_id === b.to_id);

/** A snapshot of a storage: every link by address. */
export const snapshot = (links) => allLinks(links);
