// Where does property order diverge: compact snapshot, log replay or bundle?
import {
  freshIndexedDB,
  open,
  seededEdits,
} from '../packages/ui-store/tests/persistence-helpers.js';
import { createStore } from '@link-foundation/ui-store';
const db = freshIndexedDB();
const a = await open(db);
seededEdits(a.store, 3, 30);
const s1 = a.store.toLino();
await a.persistence.compact();
await a.persistence.reload();
console.log('after compact+reload same:', a.store.toLino() === s1);
a.store.insert(null, 0, { kind: 'text', positional: ['late'] });
a.store.setProp('ok', 'label', ['After compact']);
const s2 = a.store.toLino();
await a.persistence.reload();
console.log('after log reload same:', a.store.toLino() === s2);
const fresh = createStore({ text: s1 });
console.log('text round trip same:', fresh.toLino() === s1);
await a.persistence.close();
