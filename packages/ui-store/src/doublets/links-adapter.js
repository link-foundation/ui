/**
 * The doublets of a document in any storage with the doublets interface:
 * the storages of `@link-foundation/ui-links` (memory, SQLite, doublets-web,
 * IndexedDB, localStorage and Links Notation text through its persistence
 * adapters, a synced client of a links server) or anything else with
 * `create()`, `update(id, source, target)` and `each(handler, query)`.
 *
 * Nothing is imported from ui-links: the storage is duck-typed, so ui-store
 * keeps `@link-foundation/ui-core` as its only dependency.
 */

import { check } from '../errors.js';
import { copyToDoubletsWeb } from './web-adapter.js';
import { decodeDocument } from './encode.js';

/** doublets' "any value" in a query and "go on" from an `each` handler. */
const ANY = 4294967292;
const CONTINUE = 4294967295;

/**
 * Write the doublets of `encodeDocument` into `links`, in index order. The
 * storage may hold other links: the document gets new addresses. With
 * `names` (a store with `setName(id, name)`, like ui-links `createNames()`),
 * every string point also gets its name there.
 * @param {{ links: Iterable<{ index: number, source: number, target: number }>, names: Map<string, number>, roots: number[] }} encoded
 * @param {{ create(): number, update(id: number, source: number, target: number): unknown }} links
 * @param {{ setName(id: number, name: string): unknown } | null} [names]
 * @returns {{ names: Map<string, number>, roots: number[] }} the string
 *   points and the roots at their addresses in `links`: what
 *   `readDocumentLinks` needs
 */
export function writeDocumentLinks(encoded, links, names = null) {
  const map = copyToDoubletsWeb(encoded, links);
  const at = new Map(
    [...encoded.names].map(([name, index]) => [name, map.get(index)])
  );
  if (names) {
    for (const [name, id] of at) {
      names.setName(id, name);
    }
  }
  return { names: at, roots: encoded.roots.map((index) => map.get(index)) };
}

/** The link at `id` of a doublets storage, or `null`. */
function linkAt(links, id) {
  let found = null;
  links.each(
    (link) => {
      found = { index: link.id, source: link.from_id, target: link.to_id };
      return CONTINUE;
    },
    { id, from_id: ANY, to_id: ANY }
  );
  return found;
}

/**
 * Read a document written by `writeDocumentLinks` back from `links`. Only
 * the links reachable from `roots` are read, so the storage may hold
 * anything else. Throws a `StoreError` `bad-doublets` when they are not a
 * document.
 * @param {{ each(handler: (link: { id: number, from_id: number, to_id: number }) => number, query?: object): unknown }} links
 * @param {object} where
 * @param {number[]} where.roots  `[root elements, top-level unknown]`
 * @param {Map<string, number> | Iterable<[string, number]> | { getName(id: number): string | null }} where.names
 *   the string points: a map (from `writeDocumentLinks`) or a names store
 * @returns {import('@link-foundation/ui-core').UiDocument}
 */
export function readDocumentLinks(links, { names, roots }) {
  check(
    Array.isArray(roots) && roots.length === 2,
    'bad-doublets',
    'roots must be [elements, unknown]'
  );
  const read = new Map();
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop();
    if (read.has(id)) {
      continue;
    }
    const link = linkAt(links, id);
    check(link !== null, 'bad-doublets', `Link ${id} does not exist`);
    read.set(id, link);
    stack.push(link.source, link.target);
  }
  const nameOf =
    typeof names?.getName === 'function'
      ? (id) => names.getName(id)
      : (() => {
          const byId = new Map([...names].map(([name, id]) => [id, name]));
          return (id) => byId.get(id) ?? null;
        })();
  const points = new Map();
  for (const { index, source, target } of read.values()) {
    const name = source === index && target === index ? nameOf(index) : null;
    if (name !== null && name !== undefined) {
      points.set(name, index);
    }
  }
  return decodeDocument({ links: read.values(), names: points, roots });
}
