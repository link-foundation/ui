import { describe, it, expect } from 'test-anywhere';
import { IDBFactory } from 'fake-indexeddb';
import * as ui from '@link-foundation/ui-links';
import { world } from './helpers.js';

function adapters() {
  let text = '';
  const items = new Map();
  const storage = {
    get length() {
      return items.size;
    },
    key: (i) => [...items.keys()][i] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  };
  const indexedDB = new IDBFactory();
  return {
    text: () =>
      ui.linoTextAdapter({
        read: () => text,
        write: (s) => {
          text = s;
        },
      }),
    localStorage: () => ui.localStorageAdapter(storage),
    indexedDB: () => ui.indexedDbAdapter(indexedDB, 'sync'),
  };
}

it('retires subscriptions removed offline when reusing a transport', async () => {
  const links = ui.createMemoryLinks();
  links.create();
  const server = ui.createLinksServer({ links });
  const transport = ui.connectInProcess(server);
  const client = ui.createSyncedLinks();
  await client.connect(transport);
  const { id } = await client.subscribe([]);
  client.disconnect();
  await client.unsubscribe(id);
  await client.connect(transport);
  const other = ui.createSyncedLinks({
    transport: ui.connectInProcess(server),
  });
  await other.load([]);
  other.update(1, 1, 1);
  await other.flush();
  expect(ui.getLink(client, 1)).toEqual({ id: 1, from_id: 0, to_id: 0 });
});

describe('persistent synced client', () => {
  for (const name of ['text', 'localStorage', 'indexedDB']) {
    it(`restores offline writes, counter and remaps with ${name}`, async () => {
      const make = adapters()[name];
      const opened = [];
      const open = async () => {
        const adapter = make();
        opened.push(adapter);
        return ui.openSyncedLinks({ adapter });
      };
      try {
        const a = await open();
        const x = a.create();
        a.update(x, x, x);
        const y = a.create();
        a.update(y, x, y);
        await a.flush();
        const b = await open();
        expect(ui.allLinks(b)).toEqual(ui.allLinks(a));
        expect(b.pending).toBe(3);
        const z = b.create();
        expect(z).toBe(y - 1);
        b.update(z, y, x);
        const server = ui.createLinksServer({ links: ui.createMemoryLinks() });
        await b.connect(ui.connectInProcess(server));
        expect(b.pending).toBe(0);
        expect(ui.triplesOf(server.links)).toEqual([
          [1, 1, 1],
          [2, 1, 2],
          [3, 2, 1],
        ]);
        await b.flush();
        const c = await open();
        expect(c.resolve(x)).toBe(1);
        expect(c.resolve(y)).toBe(2);
        expect(c.isTemporary(x)).toBe(false);
        expect(c.pending).toBe(0);
        expect(ui.allLinks(c)).toEqual(ui.allLinks(server.links));
        expect(c.create()).toBe(z - 1);
        await c.flush();
      } finally {
        opened.forEach((adapter) => adapter.close?.());
      }
    });
  }

  it('reconciles deletions and updates, restores subscriptions after reload', async () => {
    const make = adapters().text;
    const server = ui.createLinksServer({ links: ui.createMemoryLinks() });
    const other = ui.connectInProcess(server);
    await other.send('(create: (0 0))');
    await other.send('(create: (0 0))');
    const a = await ui.openSyncedLinks({ adapter: make() });
    await a.connect(ui.connectInProcess(server));
    const { id } = await a.subscribe([]);
    a.disconnect();
    await a.flush();
    await other.send('(delete: 1)');
    await other.send('(update: (2 2 2))');
    const b = await ui.openSyncedLinks({ adapter: make() });
    const changes = [];
    b.onChange((change) => changes.push(change));
    await b.connect(ui.connectInProcess(server));
    expect(ui.allLinks(b)).toEqual(ui.allLinks(server.links));
    expect(changes.length).toBe(2);
    expect(changes.every((c) => c.origin === 'remote')).toBe(true);
    await other.send('(create: (2 2))');
    expect(ui.allLinks(b)).toEqual(ui.allLinks(server.links));
    await b.unsubscribe(id);
    await other.send('(create: (0 0))');
    expect(b.count()).toBe(2);
  });

  it('server wins after persisted refused writes and permission changes', async () => {
    const { links, names, policy, t, v } = world();
    const server = ui.createLinksServer({ links, names, policy });
    const make = adapters().text;
    const a = await ui.openSyncedLinks({ adapter: make() });
    await a.connect(ui.connectInProcess(server, { subject: v.alice }));
    await a.load([]);
    a.disconnect();
    a.update(v.note, t.Public, v.note);
    await a.flush();
    const b = await ui.openSyncedLinks({ adapter: make() });
    const errors = [];
    const origins = [];
    b.onError((error, write) => errors.push([error.code, write?.kind]));
    b.onChange(({ origin }) => origins.push(origin));
    await b.connect(ui.connectInProcess(server, { subject: v.alice }));
    expect(errors).toEqual([['remote', 'update']]);
    expect(origins.includes('rollback')).toBe(true);
    const readable = await ui
      .createSyncedLinks({
        transport: ui.connectInProcess(server, { subject: v.alice }),
      })
      .load([]);
    expect(ui.allLinks(b)).toEqual(readable);
    await b.flush();
    expect(ui.allLinks(await ui.openSyncedLinks({ adapter: make() }))).toEqual(
      readable
    );
  });
});

describe('reconnect boundaries', () => {
  it('resumes an acknowledged self create after a failed update and reload', async () => {
    const make = adapters().text;
    const server = ui.createLinksServer({ links: ui.createMemoryLinks() });
    const a = await ui.openSyncedLinks({ adapter: make() });
    const x = a.create();
    a.update(x, x, x);
    const transport = ui.connectInProcess(server);
    await a.connect({
      send: (text) =>
        text.includes('update')
          ? Promise.reject(new Error('lost update'))
          : transport.send(text),
    });
    expect(a.pending).toBe(1);
    expect(a.resolve(x)).toBe(1);
    await a.flush();
    const b = await ui.openSyncedLinks({ adapter: make() });
    await b.connect(ui.connectInProcess(server));
    expect(ui.triplesOf(server.links)).toEqual([[1, 1, 1]]);
    expect(b.resolve(x)).toBe(1);
    expect(b.pending).toBe(0);
  });

  it('preserves writes made while the reconnect snapshot is in flight', async () => {
    const server = ui.createLinksServer({ links: ui.createMemoryLinks() });
    const a = ui.createSyncedLinks();
    await a.connect(ui.connectInProcess(server));
    a.disconnect();
    const transport = ui.connectInProcess(server);
    let release;
    let started;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    const snapshot = new Promise((resolve) => {
      started = resolve;
    });
    let first = true;
    const connecting = a.connect({
      async send(text) {
        const reply = await transport.send(text);
        if (text.includes('each') && first) {
          first = false;
          started();
          await held;
        }
        return reply;
      },
    });
    await snapshot;
    const x = a.create();
    a.update(x, x, x);
    release();
    await connecting;
    expect(ui.triplesOf(a)).toEqual([[1, 1, 1]]);
    expect(ui.allLinks(a)).toEqual(ui.allLinks(server.links));
  });

  it('refreshes an existing synchronous client on reconnect', async () => {
    const server = ui.createLinksServer({ links: ui.createMemoryLinks() });
    const a = ui.createSyncedLinks();
    await a.connect(ui.connectInProcess(server));
    const x = a.create();
    await a.flush();
    a.disconnect();
    const remote = ui.connectInProcess(server);
    await remote.send(`(update: (${a.resolve(x)} 1 1))`);
    await a.connect(ui.connectInProcess(server));
    expect(ui.allLinks(a)).toEqual(ui.allLinks(server.links));
  });
});

describe('persistent updates and readable snapshots', () => {
  it('replays persisted updates and deletes in order', async () => {
    const server = ui.createLinksServer({ links: ui.createMemoryLinks() });
    const remote = ui.connectInProcess(server);
    await remote.send('(create: (0 0))');
    await remote.send('(create: (0 0))');
    const make = adapters().text;
    const a = await ui.openSyncedLinks({
      adapter: make(),
      transport: ui.connectInProcess(server),
    });
    await a.load([]);
    a.disconnect();
    a.update(1, 1, 1);
    a.delete(2);
    await a.flush();
    const b = await ui.openSyncedLinks({ adapter: make() });
    expect(b.pending).toBe(2);
    await b.connect(ui.connectInProcess(server));
    expect(ui.triplesOf(server.links)).toEqual([[1, 1, 1]]);
    expect(ui.allLinks(b)).toEqual(ui.allLinks(server.links));
  });

  it('removes links which became unreadable while offline', async () => {
    const { links, names, policy, t, v } = world();
    const server = ui.createLinksServer({ links, names, policy });
    const a = ui.createSyncedLinks();
    await a.connect(ui.connectInProcess(server, { subject: v.alice }));
    await a.load([]);
    expect(ui.getLink(a, v.note)?.id).toBe(v.note);
    a.disconnect();
    const admin = ui.connectInProcess(server, { subject: v.boss });
    await admin.send(`(update: (${v.note} ${t.Secret} ${v.note}))`);
    const changes = [];
    a.onChange((change) => changes.push(change));
    await a.connect(ui.connectInProcess(server, { subject: v.alice }));
    expect(ui.getLink(a, v.note)).toBe(null);
    expect(
      changes.some(
        (c) =>
          c.before?.id === v.note && c.after === null && c.origin === 'remote'
      )
    ).toBe(true);
    expect(ui.allLinks(a)).toEqual(await a.load([]));
  });

  it('applies pushes received while the snapshot reply is delayed', async () => {
    const server = ui.createLinksServer({ links: ui.createMemoryLinks() });
    const remote = ui.connectInProcess(server);
    await remote.send('(create: (0 0))');
    const a = ui.createSyncedLinks();
    await a.connect(ui.connectInProcess(server));
    await a.subscribe([]);
    a.disconnect();
    const transport = ui.connectInProcess(server);
    await a.connect({
      ...transport,
      async send(text) {
        const reply = await transport.send(text);
        if (text.includes('each')) {
          await remote.send('(update: (1 1 1))');
        }
        return reply;
      },
    });
    expect(ui.allLinks(a)).toEqual(ui.allLinks(server.links));
    expect(ui.triplesOf(a)).toEqual([[1, 1, 1]]);
  });
});
