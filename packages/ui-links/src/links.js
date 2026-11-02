/**
 * The storage interface every ui-links storage implements, and helpers
 * written against it only. It is the interface of doublets-web's
 * `UnitedLinks`:
 *
 * - `create()` → the address of a new link `(0 0)`;
 * - `update(id, source, target)` → `id`;
 * - `delete(id)` → `id` (no cascade: see `withCascade`);
 * - `count(query?)` → the number of links that match;
 * - `each(handler, query?)` → `CONTINUE`, or `BREAK` when the handler
 *   returned `BREAK`. The handler gets `{ id, from_id, to_id }`.
 *
 * A query is `{ id, from_id, to_id }` (a missing part is `ANY`), an array
 * `[id, source, target]` or nothing. Storages may add `createAt(id)`: create
 * the link at that free address.
 */

import { ANY, BREAK, CONTINUE, MAX_ADDRESS } from './constants.js';

/** An error of a storage, the query engine or the protocol. */
export class LinksError extends Error {
  /**
   * @param {string} code  `not-found`, `forbidden`, `bad-request`, `limit`,
   *   `bad-reference`, `exists`
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'LinksError';
    this.code = code;
  }
}

/** `Link not found: 7`, the message of link-cli. */
export const notFound = (id) =>
  new LinksError('not-found', `Link not found: ${id}`);

/** A part of a query: a number, or `ANY` when it is missing. */
const part = (value) =>
  value === undefined || value === null || value === '*' ? ANY : value;

/**
 * A query in its object form, every part a number (`ANY` for any value).
 * @param {object | number[] | undefined} query
 * @returns {{ id: number, from_id: number, to_id: number }}
 */
export function normalizeQuery(query) {
  if (query === undefined || query === null) {
    return { id: ANY, from_id: ANY, to_id: ANY };
  }
  if (Array.isArray(query)) {
    return {
      id: part(query[0]),
      from_id: part(query[1]),
      to_id: part(query[2]),
    };
  }
  return {
    id: part(query.id),
    from_id: part(query.from_id),
    to_id: part(query.to_id),
  };
}

/** Whether `link` matches the normalized `query`. */
export const matches = (link, query) =>
  (query.id === ANY || link.id === query.id) &&
  (query.from_id === ANY || link.from_id === query.from_id) &&
  (query.to_id === ANY || link.to_id === query.to_id);

/** A plain frozen copy of a link a storage handed out. */
export const linkOf = (id, source, target) =>
  Object.freeze({ id, from_id: source, to_id: target });

/** Whether `id` is an address a link can have. */
export const isAddress = (id) =>
  Number.isSafeInteger(id) && id >= 1 && id <= MAX_ADDRESS;

/** Check the parts of an update; throw `bad-reference` otherwise. */
export function checkParts(source, target) {
  for (const value of [source, target]) {
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_ADDRESS) {
      throw new LinksError('bad-reference', `Not a link address: ${value}`);
    }
  }
}

/**
 * Every link that matches `query`, ordered by address.
 * @returns {{ id: number, from_id: number, to_id: number }[]}
 */
export function allLinks(links, query) {
  const out = [];
  links.each((link) => {
    out.push(linkOf(link.id, link.from_id, link.to_id));
    return CONTINUE;
  }, query);
  return out.sort((a, b) => a.id - b.id);
}

/** The link at `id`, or `null`. */
export function getLink(links, id) {
  if (!isAddress(id)) {
    return null;
  }
  let found = null;
  links.each(
    (link) => {
      found = linkOf(link.id, link.from_id, link.to_id);
      return BREAK;
    },
    { id, from_id: ANY, to_id: ANY }
  );
  return found;
}

/** Whether the link at `id` exists. */
export const exists = (links, id) => getLink(links, id) !== null;

/** The first link `(source target)` by address, or `null`. */
export function search(links, source, target) {
  let best = null;
  links.each(
    (link) => {
      if (best === null || link.id < best.id) {
        best = linkOf(link.id, link.from_id, link.to_id);
      }
      return CONTINUE;
    },
    { id: ANY, from_id: source, to_id: target }
  );
  return best;
}

/**
 * Make sure the link at `id` exists; a new one is `(0 0)`. Uses the
 * storage's `createAt` when it has one; otherwise creates links until it
 * gets `id` and deletes the others, as link-cli does.
 * @returns {boolean} whether it created the link
 */
export function ensureCreated(links, id) {
  if (!isAddress(id)) {
    throw new LinksError('bad-reference', `Not a link address: ${id}`);
  }
  if (exists(links, id)) {
    return false;
  }
  if (typeof links.createAt === 'function') {
    links.createAt(id);
    return true;
  }
  const extra = [];
  try {
    for (;;) {
      const created = links.create();
      if (created === id) {
        return true;
      }
      extra.push(created);
      if (created > id) {
        throw new LinksError(
          'bad-reference',
          `The storage cannot create link ${id}`
        );
      }
    }
  } finally {
    for (const other of extra.reverse()) {
      links.delete(other);
    }
  }
}

/**
 * Make a storage decorator: every method of `inner` that `methods` does not
 * replace is forwarded. `inner` stays reachable as `.inner`.
 * @template T
 * @param {T} inner
 * @param {object} methods
 * @returns {T}
 */
export function decorate(inner, methods) {
  const forward = (name) =>
    typeof inner[name] === 'function'
      ? (...args) => inner[name](...args)
      : undefined;
  const out = {
    inner,
    constants: inner.constants,
    create: forward('create'),
    update: forward('update'),
    delete: forward('delete'),
    count: forward('count'),
    each: forward('each'),
  };
  if (typeof inner.createAt === 'function') {
    out.createAt = forward('createAt');
  }
  return Object.assign(out, methods);
}

export { ANY, BREAK, CONTINUE };
