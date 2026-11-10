/**
 * The cost of a synced write is its own, not that of everything synced
 * before it (#238): settling, checkpoints and name deliveries used to walk
 * the whole cache or graph for every written link.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  connectInProcess,
  createLinksNames,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  decorate,
} from '@link-foundation/ui-links';
import { emptyClientState } from '../src/client-state.js';
import { YIELD_EVERY } from '../src/client-wire.js';

/** A memory cache counting each link its `each` hands out. */
function countingCache() {
  const inner = createMemoryLinks();
  const cache = decorate(inner, {
    each(handler, query) {
      return inner.each((link) => {
        cache.reads++;
        return handler(link);
      }, query);
    },
  });
  cache.reads = 0;
  return cache;
}

/** A server with `size` links and a client that synced all of them. */
async function synced(size, options = {}) {
  const links = createMemoryLinks();
  for (let i = 0; i < size; i++) {
    const id = links.create();
    links.update(id, id, id);
  }
  const server = createLinksServer({ links });
  const cache = countingCache();
  const client = createSyncedLinks({
    transport: connectInProcess(server),
    cache,
    ...options,
  });
  await client.subscribe([]);
  return { client, cache };
}

/** Cache links read to create, update, delete and flush a few links. */
async function writeReads(size) {
  const { client, cache } = await synced(size);
  cache.reads = 0;
  for (let i = 0; i < 3; i++) {
    const id = client.create();
    client.update(id, 1, id);
    client.update(id, id, 1);
    client.delete(id);
  }
  await client.flush();
  return cache.reads;
}

describe('synced write cost', () => {
  it('settles writes by reading what they change, not the whole cache', async () => {
    const small = await writeReads(10);
    expect(small).toBeGreaterThan(0);
    expect(await writeReads(1000)).toBe(small);
  });

  it('builds no checkpoint without a saveState', async () => {
    let reads = 0;
    const state = emptyClientState();
    let connected = state.connected;
    Object.defineProperty(state, 'connected', {
      get: () => {
        reads++;
        return connected;
      },
      set: (value) => {
        connected = value;
      },
    });
    const { client } = await synced(1, { state });
    reads = 0;
    for (let i = 0; i < 10; i++) {
      client.update(client.create(), 1, 1);
    }
    await client.flush();
    expect(reads).toBe(0);
  });

  it('decodes the names once per subscription delivery', async () => {
    const links = createMemoryLinks();
    const names = createLinksNames(links);
    const calls = { namesOf: 0, bindings: 0, dependencies: 0 };
    const counted = Object.fromEntries(
      Object.keys(calls).map((key) => [
        key,
        (ids) => {
          calls[key]++;
          return names[key](ids);
        },
      ])
    );
    const server = createLinksServer({
      links,
      names: { ...names, withLinks: undefined, ...counted },
    });
    const id = links.create();
    links.update(id, id, id);
    names.setName(id, 'root');
    const client = createSyncedLinks({ transport: connectInProcess(server) });
    await client.subscribe([]);
    Object.keys(calls).forEach((key) => (calls[key] = 0));
    client.update(client.create(), id, id);
    await client.flush();
    // The update joins the create: one write, delivered to one subscription.
    expect(calls).toEqual({ namesOf: 1, bindings: 0, dependencies: 0 });
  });

  it('lets timers run during a long flush', async () => {
    const { client } = await synced(1);
    let fired = false;
    setTimeout(() => (fired = true), 0);
    for (let i = 0; i <= YIELD_EVERY; i++) {
      client.update(client.create(), 1, 1);
    }
    let firedDuringFlush = false;
    const flushing = client.flush().then(() => (firedDuringFlush = fired));
    await flushing;
    expect(firedDuringFlush).toBe(true);
  });
});
