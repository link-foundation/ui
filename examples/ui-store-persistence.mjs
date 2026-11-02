// Usage of openPersistentStore: a UI document saved to IndexedDB, opened
// again, compacted, exported as a .lino bundle and copied into doublets-web.
// In Node.js the IndexedDB is fake-indexeddb (a dev dependency); a browser
// leaves the indexedDB option out.
// Run: node examples/ui-store-persistence.mjs
import { IDBFactory } from 'fake-indexeddb';
import {
  copyToDoubletsWeb,
  openDoubletsWeb,
  openPersistentStore,
} from '@link-foundation/ui-store';

const indexedDB = new IDBFactory();
const options = {
  name: 'demo',
  indexedDB,
  initialText: "(main: stack (ok: button (label 'OK')) (text 'Hello'))",
  channel: false,
};

const first = await openPersistentStore(options);
first.store.setProp('ok', 'label', ['Cancel']);
first.store.insert('main', undefined, { kind: 'text', positional: ['Bye'] });
await first.persistence.close();

// The next page load: the edits are there, and new ones can be undone.
const { store, persistence } = await openPersistentStore(options);
console.log(store.toLino());
store.remove('ok');
store.undo();
await persistence.compact(); // snapshot = the current document, log emptied
store.setProp('ok', 'variant', ['primary']);
console.log(await persistence.exportBundle());

try {
  const { links } = await openDoubletsWeb();
  const encoded = await persistence.readDoublets();
  copyToDoubletsWeb(encoded, links);
  console.log(
    `doublets-web: ${links.count()} of ${encoded.links.length} links`
  );
} catch (error) {
  console.log(`doublets-web is not available here: ${error.message}`);
}

await persistence.destroy();
