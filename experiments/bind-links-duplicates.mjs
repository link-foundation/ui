// Count links created by one setProp and duplicate (from,to) pairs (issue #238).
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
const dump = (l) => { const r = []; l.each((x) => { r.push(x); return 4294967295; }); return r; };
const report = (label) => {
  const all = dump(links);
  const pairs = new Map();
  for (const x of all) if (x.from_id !== 0 && !(x.from_id === x.id && x.to_id === x.id)) {
    const k = `${x.from_id} ${x.to_id}`; pairs.set(k, (pairs.get(k) ?? 0) + 1);
  }
  const dup = [...pairs].filter(([, n]) => n > 1);
  const pts = all.filter((x) => x.from_id === x.id && x.to_id === x.id).length;
  console.log(label, 'server links', all.length, 'points', pts, 'dup pairs', dup.length, dup.slice(0, 5));
};
report('initial');
const c = clients[0];
let creates = 0, updates = 0;
const oc = c.create.bind(c), ou = c.update.bind(c);
c.create = (...a) => { creates++; return oc(...a); };
c.update = (...a) => { updates++; return ou(...a); };
const origEach = c.each.bind(c);
let eachCalls = 0;
c.each = (...a) => { eachCalls++; return origEach(...a); };
const t = performance.now();
stores[0].setProp('a', 'label', ['First']);
console.log('setProp sync ms', (performance.now() - t).toFixed(0), 'creates', creates, 'updates', updates, 'each', eachCalls);
await Promise.all(clients.map((x) => x.flush()));
await Promise.all(bindings.map((x) => x.flush()));
report('after setProp');
