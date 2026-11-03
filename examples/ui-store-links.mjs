// A UI document of @link-foundation/ui-store kept in the associative links
// storages of @link-foundation/ui-links: SQLite here, the same way in
// memory, doublets-web, IndexedDB or behind a links server.
// Run: node examples/ui-store-links.mjs
import { DatabaseSync } from 'node:sqlite';
import {
  createNames,
  createSqlLinks,
  linksToLino,
  runQuery,
} from '@link-foundation/ui-links';
import {
  createStore,
  encodeDocument,
  readDocumentLinks,
  writeDocumentLinks,
} from '@link-foundation/ui-store';

const store = createStore({
  text: `ok: button
  label 'OK'`,
});
const links = createSqlLinks(new DatabaseSync(':memory:'));
const names = createNames();
const where = writeDocumentLinks(
  encodeDocument(store.toDocument()),
  links,
  names
);
console.log(linksToLino(links, { names }));

// Substitution queries see the document like any other links: read the
// links whose target is the point `button` (the same restriction and
// substitution is a read).
const found = runQuery({ links, names }, '(($i: $s button)) (($i: $s button))');
console.log(found.map(({ after }) => after));

const back = createStore({
  document: readDocumentLinks(links, { names, roots: where.roots }),
});
console.log(back.toLino()); // the same document
