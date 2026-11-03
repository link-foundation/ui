// Two synced clients of one in-process server: optimistic writes, temporary
// addresses, subscriptions, a refused write and the offline queue.
import {
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  allLinks,
} from '@link-foundation/ui-links';

const server = createLinksServer({ links: createMemoryLinks() });
const a = createSyncedLinks({ transport: connectInProcess(server) });
const b = createSyncedLinks({ transport: connectInProcess(server) });
b.onChange((c) => console.log('b change', c.origin, c.before, c.after));
a.onRemap((t, id) => console.log('a remap', t, '->', id));
a.onError((e, w) => console.log('a error', e.message, w?.kind));
console.log('b subscribe', await b.subscribe([]));

const x = a.create();
a.update(x, x, x);
const y = a.create();
a.update(y, x, y);
console.log('a before flush', allLinks(a), a.pending);
await a.flush();
console.log('a after flush', allLinks(a), a.pending);
console.log('server', allLinks(server.links));
console.log('b', allLinks(b));

// refused: a link of b that a does not know is fine locally; the server
// refuses an update of a link that it deleted already.
await b.flush();
b.delete(1);
await b.flush();
console.log('server after b delete', allLinks(server.links));
a.update(1, 0, 0);
await a.flush();
console.log('a after refused', allLinks(a));

// offline queue
a.disconnect();
const z = a.create();
a.update(z, z, 0);
console.log('a offline pending', a.pending, allLinks(a));
await a.connect(connectInProcess(server));
console.log(
  'a reconnected',
  a.pending,
  allLinks(a),
  'server',
  allLinks(server.links)
);
console.log('query', await a.query('() ((n: n n))'));
console.log('a after query', allLinks(a));
