import { describe, it, expect } from 'test-anywhere';
import {
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  createLinksNames,
} from '@link-foundation/ui-links';
import * as api from '@link-foundation/ui-store';

const TEXT = 'app: column\n  a: text A\n  b: text B';
async function fixture() {
  const links = createMemoryLinks();
  const where = api.writeDocumentLinks(
    api.encodeDocument(api.createStore({ text: TEXT }).toDocument()),
    links,
    createLinksNames(links)
  );
  let refusing = false;
  const initialIds = new Set();
  links.each((link) => {
    initialIds.add(link.id);
    return 4294967295;
  });
  const server = createLinksServer({
    links,
    names: createLinksNames(links),
    policy: {
      canRead: () => true,
      canCreate: () => true,
      canWrite: (_subject, link) =>
        !(refusing && initialIds.has(link.id) && link.from_id === 0),
    },
  });
  const clients = [0, 1].map(() =>
    createSyncedLinks({ transport: connectInProcess(server) })
  );
  await Promise.all(clients.map((c) => c.subscribe([])));
  const stores = clients.map(() => api.createStore());
  const bindings = stores.map((s, i) =>
    api.bindStoreLinks(s, clients[i], where)
  );
  const flush = async () => {
    await Promise.all(clients.map((c) => c.flush()));
    await Promise.all(bindings.map((b) => b.flush()));
  };
  return {
    links,
    where,
    server,
    clients,
    stores,
    bindings,
    flush,
    refuse: () => {
      refusing = true;
    },
  };
}

describe('bindStoreLinks', () => {
  it('converges concurrent different-node edits and ignores links history', async () => {
    const f = await fixture();
    const [a, b] = f.stores;
    expect(a.toLino()).toBe(b.toLino());
    expect(a.canUndo()).toBe(false);
    a.setPositional('a', ['Alice']);
    b.setPositional('b', ['Bob']);
    await f.flush();
    expect(a.toLino()).toBe(b.toLino());
    expect(a.get('a').positional).toEqual(['Alice']);
    expect(a.get('b').positional).toEqual(['Bob']);
    expect(a.log().at(-1).origin).toBe('links');
    a.undo();
    await f.flush();
    expect(a.get('a').positional).toEqual(['A']);
    expect(a.get('b').positional).toEqual(['Bob']);
    expect(a.toLino()).toBe(b.toLino());
  });

  it('maps every store operation including anonymous nodes, empty roots and undo', async () => {
    const f = await fixture();
    const [a, b] = f.stores;
    const check = async (fn) => {
      fn();
      await f.flush();
      expect(a.toLino()).toBe(b.toLino());
    };
    await check(() => a.setProp('a', 'label', ['First']));
    await check(() =>
      a.apply({
        op: 'setProp',
        id: 'a',
        name: 'label',
        values: ['Duplicate'],
        index: 0,
      })
    );
    await check(() => a.removeProp('a', 'label'));
    let id;
    await check(() => {
      id = a.insert('app', 1, { kind: 'text', positional: ['Anonymous'] });
    });
    await check(() => a.setPositional(id, ['Changed']));
    await check(() => a.move(id, null, 0));
    await check(() => {
      id = a.rename(id, 'named');
    });
    await check(() => {
      id = a.rename(id, null);
    });
    await check(() => a.remove('app'));
    await check(() => a.remove(id));
    expect(b.roots()).toEqual([]);
    await check(() => a.undo());
    await check(() => a.redo());
    await check(() => a.insert(null, 0, { id: 'new', kind: 'text' }));
  });

  it('rolls the store back when the server refuses an existing handle update', async () => {
    const f = await fixture();
    const [a] = f.stores;
    const client = f.clients[0];
    const errors = [];
    client.onError((error) => errors.push(error.code));
    f.refuse();
    const before = a.toLino();
    a.setPositional('a', ['Refused']);
    await f.flush();
    expect(errors).toEqual(['remote']);
    expect(a.toLino()).toBe(before);
    expect(f.stores[1].toLino()).toBe(before);
  });

  it('applies direct local link updates as links-origin operations', async () => {
    const f = await fixture();
    let original;
    const stop = f.clients[0].onChange(({ before, after }) => {
      if (before?.from_id === 0 && after?.from_id === 0) {
        original ??= before;
      }
    });
    f.stores[0].setPositional('a', ['New']);
    await f.flush();
    stop();
    f.clients[0].update(original.id, original.from_id, original.to_id);
    await f.flush();
    expect(f.stores[0].get('a').positional).toEqual(['A']);
    expect(f.stores[1].toLino()).toBe(f.stores[0].toLino());
    expect(f.stores[0].log().at(-1).origin).toBe('links');
  });

  it('stops both directions on dispose', async () => {
    const f = await fixture();
    f.bindings[0]();
    const count = f.clients[0].pending;
    f.stores[0].setPositional('a', ['Detached']);
    expect(f.clients[0].pending).toBe(count);
    f.stores[1].setPositional('b', ['Remote']);
    await f.flush();
    expect(f.stores[0].get('b').positional).toEqual(['B']);
  });
});

describe('binding boundaries', () => {
  it('binds an already populated store and performs no writes for a no-op', async () => {
    const f = await fixture();
    f.bindings[0]();
    const store = api.createStore({ text: TEXT });
    const binding = api.bindStoreLinks(store, f.clients[0], f.where);
    expect(store.toLino()).toBe(f.stores[1].toLino());
    store.setPositional('a', ['A']);
    expect(f.clients[0].pending).toBe(0);
    binding();
  });

  it('catches up after offline edits and reconnect', async () => {
    const f = await fixture();
    f.clients[0].disconnect();
    f.stores[0].setPositional('a', ['Offline']);
    f.stores[1].setPositional('b', ['Online']);
    await f.clients[1].flush();
    await f.clients[0].connect(connectInProcess(f.server));
    await f.flush();
    expect(f.stores[0].toLino()).toBe(f.stores[1].toLino());
    expect(f.stores[0].get('a').positional).toEqual(['Offline']);
    expect(f.stores[0].get('b').positional).toEqual(['Online']);
  });
});

describe('document strings', () => {
  it('converges when concurrent nodes introduce the same string', async () => {
    const f = await fixture();
    f.stores[0].setPositional('a', ['Shared']);
    f.stores[1].setPositional('b', ['Shared']);
    await f.flush();
    for (const store of f.stores) {
      expect(store.get('a').positional).toEqual(['Shared']);
      expect(store.get('b').positional).toEqual(['Shared']);
    }
  });

  it('syncs values reserved by the query name namespace', async () => {
    const f = await fixture();
    f.stores[0].setPositional('a', ['', '123', '*', '$variable', '!literal']);
    await f.flush();
    expect(f.stores[0].toLino()).toBe(f.stores[1].toLino());
    expect(f.stores[1].get('a').positional).toEqual([
      '',
      '123',
      '*',
      '$variable',
      '!literal',
    ]);
  });
});

describe('opaque document links', () => {
  it('syncs top-level unknown values as replayable operations', async () => {
    const f = await fixture();
    f.stores[0].apply({
      op: 'setDocumentUnknown',
      values: [['metadata', 'value']],
    });
    await f.flush();
    expect(f.stores[1].toDocument().unknown).toEqual([['metadata', 'value']]);
    const replay = api.createStore();
    replay.replay(api.logFromLino(api.logToLino(f.stores[1].log())));
    expect(replay.toLino()).toBe(f.stores[1].toLino());
    f.stores[0].undo();
    await f.flush();
    expect(f.stores[1].toDocument().unknown).toEqual([]);
  });
});

describe('incremental writes', () => {
  it('publishes a scalar edit by updating only one existing element handle', async () => {
    const f = await fixture();
    const existing = new Set();
    f.clients[0].each((link) => {
      existing.add(link.id);
      return 4294967295;
    });
    const changed = [];
    const stop = f.clients[0].onChange(({ before, after, origin }) => {
      if (origin === 'local' && before && existing.has(before.id)) {
        changed.push(after);
      }
    });
    const roots = [...f.where.roots];
    f.stores[0].setPositional('a', ['New']);
    expect(changed.length).toBe(1);
    expect(changed[0].from_id).toBe(0);
    expect(f.where.roots).toEqual(roots);
    await f.flush();
    stop();
  });
});
