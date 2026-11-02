import { IDBFactory } from 'fake-indexeddb';
import { openPersistentStore } from '@link-foundation/ui-store';
const indexedDB = new IDBFactory();
const { store, persistence } = await openPersistentStore({
  name: 'demo',
  indexedDB,
  initialText: "(ok: button (label 'OK'))\n(stack (text a))\n",
});
store.setProp('ok', 'label', ['Cancel']);
store.insert('_2', 0, { kind: 'text', positional: ['b'] });
store.undo();
await persistence.compact();
store.setProp('ok', 'label', ['X']);
console.log(await persistence.exportBundle());
await persistence.close();
const again = await openPersistentStore({ name: 'demo', indexedDB });
console.log(again.store.toLino() === store.toLino(), again.store.toLino());
await again.persistence.destroy();
