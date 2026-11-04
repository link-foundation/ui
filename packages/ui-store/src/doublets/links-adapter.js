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

import { decodeDocument } from './encode.js';

import { storedName } from './string-names.js';
import { documentWriter, readGraph } from './live-graph.js';

/**
 * Write an encoded document with stable root and element handles. String
 * names can be supplied separately or stored in the links client's names.
 * @returns {{ names: Map<string, number>, roots: number[] }}
 */
export function writeDocumentLinks(encoded, links, names = null) {
  const document = decodeDocument(encoded);
  const at = new Map();
  const writer = documentWriter(links, {
    get: (text) => at.get(text),
    set(text, id) {
      at.set(text, id);
      names?.setName(id, storedName(text));
    },
  });
  const handles = new Map();
  const element = (node) =>
    writer.element(node, node, node.children.map(element), handles);
  const roots = [
    writer.handle(writer.sequence(document.roots.map(element))),
    writer.handle(writer.values(document.unknown)),
  ];
  return { names: at, roots };
}

/** Read a live document or an older immutable document from its roots. */
export function readDocumentLinks(links, where) {
  return readGraph(links, where).document;
}
