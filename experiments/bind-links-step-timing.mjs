// Time each step of the bind-links operation-mapping test.
import { performance } from 'node:perf_hooks';
import {
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  createLinksNames,
} from '@link-foundation/ui-links';
import * as api from '@link-foundation/ui-store';

const TEXT = 'app: column\n  a: text A\n  b: text B';
const links = createMemoryLinks();
const where = api.writeDocumentLinks(
  api.encodeDocument(api.createStore({ text: TEXT }).toDocument()),
  links,
  createLinksNames(links)
);
const server = createLinksServer({
  links,
  names: createLinksNames(links),
  policy: { canRead: () => true, canCreate: () => true, canWrite: () => true },
});
const clients = [0, 1].map(() =>
  createSyncedLinks({ transport: connectInProcess(server) })
);
await Promise.all(clients.map((c) => c.subscribe([])));
const stores = clients.map(() => api.createStore());
const bindings = stores.map((s, i) => api.bindStoreLinks(s, clients[i], where));
const count = () => {
  let n = 0;
  links.each(() => {
    n++;
    return 4294967295;
  });
  return n;
};
const [a, b] = stores;
let step = 0;
const check = async (label, fn) => {
  const t0 = performance.now();
  fn();
  const t1 = performance.now();
  await Promise.all(clients.map((c) => c.flush()));
  const t2 = performance.now();
  await Promise.all(bindings.map((x) => x.flush()));
  const t3 = performance.now();
  console.log(
    `${String(++step).padStart(2)} ${label.padEnd(14)} op ${(t1 - t0).toFixed(0).padStart(6)}ms  clientFlush ${(t2 - t1).toFixed(0).padStart(6)}ms  bindFlush ${(t3 - t2).toFixed(0).padStart(6)}ms  links ${count()} equal ${a.toLino() === b.toLino()}`
  );
};
console.log('initial links', count());
await check('setProp', () => a.setProp('a', 'label', ['First']));
await check('apply setProp', () =>
  a.apply({
    op: 'setProp',
    id: 'a',
    name: 'label',
    values: ['Duplicate'],
    index: 0,
  })
);
await check('removeProp', () => a.removeProp('a', 'label'));
let id;
await check('insert anon', () => {
  id = a.insert('app', 1, { kind: 'text', positional: ['Anonymous'] });
});
await check('setPositional', () => a.setPositional(id, ['Changed']));
await check('move', () => a.move(id, null, 0));
await check('rename named', () => {
  id = a.rename(id, 'named');
});
await check('rename null', () => {
  id = a.rename(id, null);
});
await check('remove app', () => a.remove('app'));
await check('remove id', () => a.remove(id));
await check('undo', () => a.undo());
await check('redo', () => a.redo());
await check('insert new', () => a.insert(null, 0, { id: 'new', kind: 'text' }));
