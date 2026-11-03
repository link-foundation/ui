/**
 * The synced client over an in-process server and over TCP, and link-cli's
 * own client (`@link-foundation/link-cli-client`) against the server.
 */

import { describe, it, expect } from 'test-anywhere';
import { createWasmClient } from '@link-foundation/link-cli-client';
import { connectTcp } from '@link-foundation/link-cli-client/tcp';
import {
  allLinks,
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  linksToLino,
  MAX_ADDRESS,
} from '@link-foundation/ui-links';
import { connectLinks, listenLinks } from '@link-foundation/ui-links/tcp';
import { world } from './helpers.js';

/** Resolve once `check()` holds (pushes arrive asynchronously over TCP). */
async function until(check, tries = 100) {
  for (let i = 0; i < tries && !check(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return check();
}

describe('synced client', () => {
  it('writes optimistically and moves temporary addresses', async () => {
    const server = createLinksServer({ links: createMemoryLinks() });
    const a = createSyncedLinks({ transport: connectInProcess(server) });
    const remaps = [];
    const origins = [];
    a.onRemap((temp, id) => remaps.push([temp, id]));
    a.onChange(({ origin }) => origins.push(origin));
    const x = a.create();
    a.update(x, x, x);
    expect(x).toBe(MAX_ADDRESS);
    expect(a.isTemporary(x)).toBe(true);
    expect(allLinks(a)).toEqual([{ id: x, from_id: x, to_id: x }]);
    await a.flush();
    expect(remaps).toEqual([[x, 1]]);
    expect(a.resolve(x)).toBe(1);
    expect(a.isTemporary(x)).toBe(false);
    expect(allLinks(a)).toEqual([{ id: 1, from_id: 1, to_id: 1 }]);
    expect(linksToLino(server.links)).toBe('(1: 1 1)');
    expect(origins).toEqual(['local', 'local', 'remap']);
    expect(a.pending).toBe(0);
  });

  it('receives what other clients change in a subscription', async () => {
    const server = createLinksServer({ links: createMemoryLinks() });
    const a = createSyncedLinks({ transport: connectInProcess(server) });
    const b = createSyncedLinks({ transport: connectInProcess(server) });
    const one = a.create();
    await a.flush();
    const { id, links } = await b.subscribe([]);
    expect(id).toBe(1);
    expect(links).toEqual([{ id: 1, from_id: 0, to_id: 0 }]);
    a.update(a.resolve(one), 1, 1);
    const two = a.create();
    a.update(two, 1, two);
    await a.flush();
    expect(linksToLino(b)).toBe('(1: 1 1)\n(2: 1 2)');
    a.delete(1);
    await a.flush();
    expect(b.count([])).toBe(0);
    await b.unsubscribe(id);
    a.create();
    await a.flush();
    expect(b.count([])).toBe(0);
  });

  it('queues writes offline and sends them on connect', async () => {
    const server = createLinksServer({ links: createMemoryLinks() });
    const a = createSyncedLinks();
    const x = a.create();
    a.update(x, 0, x);
    expect(a.connected).toBe(false);
    expect(a.pending).toBe(1);
    await a.connect(connectInProcess(server));
    expect(a.connected).toBe(true);
    expect(a.pending).toBe(0);
    expect(linksToLino(server.links)).toBe('(1: 0 1)');
  });

  it('keeps writes when the transport fails', async () => {
    const server = createLinksServer({ links: createMemoryLinks() });
    const errors = [];
    const broken = { send: () => Promise.reject(new Error('socket closed')) };
    const a = createSyncedLinks({ transport: broken });
    a.onError((error, write) => errors.push([error.message, write]));
    a.create();
    await a.flush();
    expect(errors).toEqual([['socket closed', null]]);
    expect(a.connected).toBe(false);
    expect(a.pending).toBe(1);
    await a.connect(connectInProcess(server));
    expect(server.links.count([])).toBe(1);
  });

  it('rolls back what the server refuses', async () => {
    const { links, names, policy, t, v } = world();
    const server = createLinksServer({ links, names, policy });
    const transport = connectInProcess(server, { subject: v.alice });
    const a = createSyncedLinks({ transport });
    const errors = [];
    a.onError((error, write) => errors.push([error.code, write?.kind]));
    await a.load([]);
    expect(allLinks(a).map((l) => l.id)).toEqual([t.Shared, v.note, v.shared]);
    a.update(v.note, t.Public, v.note);
    expect(allLinks(a, [v.note])[0].from_id).toBe(t.Public);
    await a.flush();
    expect(errors).toEqual([['remote', 'update']]);
    expect(allLinks(a, [v.note])[0].from_id).toBe(t.Note);
    const mine = a.create();
    a.update(mine, t.Note, mine);
    await a.flush();
    expect(errors).toEqual([['remote', 'update']]);
    expect(allLinks(links, [a.resolve(mine)])[0].from_id).toBe(t.Note);
  });

  it('runs queries on the server and reads names in the reply', async () => {
    const server = createLinksServer({
      links: createMemoryLinks(),
      autoCreate: true,
    });
    const a = createSyncedLinks({ transport: connectInProcess(server) });
    const changes = await a.query('() ((p: x y))');
    expect(changes.map(({ after }) => after)).toEqual([
      { id: 1, from_id: 2, to_id: 3 },
      { id: 2, from_id: 2, to_id: 2 },
      { id: 3, from_id: 3, to_id: 3 },
    ]);
    expect(linksToLino(a)).toBe('(1: 2 3)\n(2: 2 2)\n(3: 3 3)');
  });
});

describe('link-cli client against the server', () => {
  it('works through createWasmClient', async () => {
    const server = createLinksServer({ links: createMemoryLinks() });
    const client = createWasmClient(server.session());
    expect((await client.create(0, 0)).index).toBe(1n);
    await client.setName(1, 'one');
    expect(await client.getByName('one')).toBe(1n);
    expect(await client.count([])).toBe(1n);
    await client.close();
  });

  it('works over TCP, with pushes to a synced client', async () => {
    const server = createLinksServer({ links: createMemoryLinks() });
    const listener = await listenLinks(server, { port: 0 });
    const cli = await connectTcp(listener.address);
    const transport = await connectLinks(listener.address);
    const synced = createSyncedLinks({ transport });
    try {
      await synced.subscribe([]);
      await cli.create(0, 0);
      await cli.update(1, 1, 1);
      expect(await until(() => linksToLino(synced) === '(1: 1 1)')).toBe(true);
      const x = synced.create();
      synced.update(x, 1, x);
      await synced.flush();
      expect(await cli.exportLinks()).toEqual([
        { index: '1', source: '1', target: '1' },
        { index: '2', source: '1', target: '2' },
      ]);
    } finally {
      await cli.close();
      await transport.close();
      await listener.close();
    }
  });
});
