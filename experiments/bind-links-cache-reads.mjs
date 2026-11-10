// Count links the synced caches hand out during the mapping sequence.
import { performance } from 'node:perf_hooks';
import {
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  createLinksNames,
  decorate,
} from '@link-foundation/ui-links';
import * as api from '@link-foundation/ui-store';

const TEXT = 'app: column\n  a: text A\n  b: text B';
const links = createMemoryLinks();
const where = api.writeDocumentLinks(
  api.encodeDocument(api.createStore({ text: TEXT }).toDocument()),
  links,
  createLinksNames(links)
);
const server = createLinksServer({ links, names: createLinksNames(links) });
let reads = 0;
const counting = () => {
  const inner = createMemoryLinks();
  return decorate(inner, {
    each: (h, q) =>
      inner.each((l) => {
        reads++;
        return h(l);
      }, q),
  });
};
const clients = [0, 1].map(() =>
  createSyncedLinks({ transport: connectInProcess(server), cache: counting() })
);
await Promise.all(clients.map((c) => c.subscribe([])));
const stores = clients.map(() => api.createStore());
const bindings = stores.map((s, i) => api.bindStoreLinks(s, clients[i], where));
const [a] = stores;
const flush = async () => {
  await Promise.all(clients.map((c) => c.flush()));
  await Promise.all(bindings.map((b) => b.flush()));
};
const t = performance.now();
reads = 0;
a.setProp('a', 'label', ['First']);
await flush();
console.log('setProp reads', reads);
reads = 0;
a.setPositional('b', ['Bob']);
await flush();
console.log(
  'setPositional reads',
  reads,
  'ms',
  (performance.now() - t).toFixed(0)
);
