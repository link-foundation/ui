// Show which links each store edit creates via the binding writer (issue #238).
import {
  connectInProcess, createLinksServer, createMemoryLinks,
  createSyncedLinks, createLinksNames,
} from '@link-foundation/ui-links';
import * as api from '@link-foundation/ui-store';

const TEXT = 'app: column\n  a: text A\n  b: text B';
const links = createMemoryLinks();
const where = api.writeDocumentLinks(
  api.encodeDocument(api.createStore({ text: TEXT }).toDocument()),
  links, createLinksNames(links));
const server = createLinksServer({ links, names: createLinksNames(links),
  policy: { canRead: () => true, canCreate: () => true, canWrite: () => true } });
const clients = [0, 1].map(() => createSyncedLinks({ transport: connectInProcess(server) }));
await Promise.all(clients.map((c) => c.subscribe([])));
const stores = clients.map(() => api.createStore());
const bindings = stores.map((s, i) => api.bindStoreLinks(s, clients[i], where));
const c = clients[0];
const ids = () => { const s = new Set(); c.each((x) => { s.add(x.id); return 4294967295; }); return s; };
const flush = async () => { await Promise.all(clients.map((x) => x.flush())); await Promise.all(bindings.map((x) => x.flush())); };
const step = async (label, fn) => {
  const before = ids();
  fn();
  await flush();
  const created = [...ids()].filter((x) => !before.has(x));
  const get = (id) => { let f; c.each((x) => { f = x; return 4294967295; }, { id }); return f; };
  const shapes = created.map(get).map((x) => x.from_id === x.id ? `pt:${c.names?.getName?.(x.id)}` : `${x.from_id}->${x.to_id}`);
  console.log(label, created.length, shapes.slice(0, 40).join(' '));
};
await step('setProp', () => stores[0].setProp('a', 'label', ['First']));
await step('setProp2', () => stores[0].setProp('a', 'label', ['Second']));
await step('setPositional', () => stores[0].setPositional('a', ['X']));
