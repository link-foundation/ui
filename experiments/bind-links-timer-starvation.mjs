// Does a synced-client flush over connectInProcess starve timers?
// A test timeout is a timer; if it cannot fire during a flush, a slow flush
// cannot be reported by --test-timeout.
import { performance } from 'node:perf_hooks';
import {
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  createLinksNames,
} from '@link-foundation/ui-links';
import * as api from '@link-foundation/ui-store';

const links = createMemoryLinks();
const where = api.writeDocumentLinks(
  api.encodeDocument(
    api.createStore({ text: 'app: column\n  a: text A' }).toDocument()
  ),
  links,
  createLinksNames(links)
);
const server = createLinksServer({ links, names: createLinksNames(links) });
const client = createSyncedLinks({ transport: connectInProcess(server) });
await client.subscribe([]);
const store = api.createStore();
const binding = api.bindStoreLinks(store, client, where);
store.setProp('a', 'label', ['First']);
const t0 = performance.now();
let fired = null;
setTimeout(() => {
  fired = performance.now() - t0;
}, 10);
await client.flush();
const took = performance.now() - t0;
console.log(
  `flush ${took.toFixed(0)}ms; 10ms timer fired at ${fired === null ? 'never during flush' : `${fired.toFixed(0)}ms`}`
);
await binding.flush();
